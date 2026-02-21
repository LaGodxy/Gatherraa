import { Injectable, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import Stripe from 'stripe';
import { Payment, PaymentStatus, PaymentCurrency } from '../entities/payment.entity';
import { PaymentRefund, RefundStatus } from '../entities/payment-refund.entity';
import { SavedPaymentMethod } from '../entities/saved-payment-method.entity';
import { ConfirmStripePaymentDto, InitiateStripePaymentDto } from '../dto/payment.dto';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class StripeService {
  private stripe: Stripe;

  constructor(
    private configService: ConfigService,
    @InjectRepository(Payment)
    private paymentRepository: Repository<Payment>,
    @InjectRepository(PaymentRefund)
    private refundRepository: Repository<PaymentRefund>,
    @InjectRepository(SavedPaymentMethod)
    private savedPaymentMethodRepository: Repository<SavedPaymentMethod>,
  ) {
    this.stripe = new Stripe(this.configService.get('STRIPE_SECRET_KEY'), {
      apiVersion: '2024-04-10',
    });
  }

  /**
   * Create a Stripe customer for a user
   */
  async createOrGetCustomer(userId: string, email?: string): Promise<string> {
    const payment = await this.paymentRepository.findOne({
      where: { userId },
    });

    if (payment?.stripeCustomerId) {
      return payment.stripeCustomerId;
    }

    try {
      const customer = await this.stripe.customers.create({
        email,
        metadata: {
          userId,
        },
      });

      return customer.id;
    } catch (error) {
      throw new InternalServerErrorException('Failed to create Stripe customer');
    }
  }

  /**
   * Initiate a Stripe payment intent
   */
  async initiatePayment(dto: InitiateStripePaymentDto): Promise<{ paymentIntentId: string; clientSecret: string }> {
    try {
      const customerId = await this.createOrGetCustomer(dto.userId, dto.email);

      // Convert amount to cents
      const amountInCents = Math.round(dto.amount * 100);

      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: amountInCents,
        currency: dto.currency.toLowerCase(),
        customer: customerId,
        description: dto.description || `Payment for ${dto.type}`,
        statement_descriptor: dto.statementDescriptor,
        metadata: {
          userId: dto.userId,
          type: dto.type,
          ...dto.metadata,
        },
        idempotency_key: dto.idempotencyKey || uuidv4(),
      });

      // Create payment record
      const payment = this.paymentRepository.create({
        userId: dto.userId,
        method: 'stripe',
        currency: dto.currency as PaymentCurrency,
        type: dto.type,
        amount: BigInt(amountInCents),
        amountDisplayValue: dto.amount,
        stripePaymentIntentId: paymentIntent.id,
        stripeCustomerId: customerId,
        stripeCurrency: dto.currency,
        status: PaymentStatus.PENDING,
        idempotencyKey: dto.idempotencyKey,
        metadata: {
          description: dto.description,
          customData: dto.metadata,
        },
      });

      await this.paymentRepository.save(payment);

      return {
        paymentIntentId: paymentIntent.id,
        clientSecret: paymentIntent.client_secret,
      };
    } catch (error) {
      if (error instanceof Stripe.errors.StripeError) {
        throw new BadRequestException(`Stripe error: ${error.message}`);
      }
      throw new InternalServerErrorException('Failed to initiate payment');
    }
  }

  /**
   * Confirm a Stripe payment
   */
  async confirmPayment(dto: ConfirmStripePaymentDto): Promise<Payment> {
    try {
      const paymentIntent = await this.stripe.paymentIntents.retrieve(dto.paymentIntentId);

      if (paymentIntent.status === 'succeeded') {
        const payment = await this.paymentRepository.findOne({
          where: { stripePaymentIntentId: dto.paymentIntentId },
        });

        if (payment) {
          payment.status = PaymentStatus.SUCCEEDED;
          payment.stripeChargeId = paymentIntent.latest_charge as string;
          payment.webhookProcessed = true;
          payment.webhookProcessedAt = new Date();
          payment.providerResponse = JSON.parse(JSON.stringify(paymentIntent));

          return await this.paymentRepository.save(payment);
        }
      }

      throw new BadRequestException('Payment intent not in succeeded state');
    } catch (error) {
      if (error instanceof Stripe.errors.StripeError) {
        throw new BadRequestException(`Stripe error: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Save a payment method
   */
  async savePaymentMethod(
    userId: string,
    paymentMethodId: string,
    nickname: string,
    setAsDefault?: boolean,
  ): Promise<SavedPaymentMethod> {
    try {
      if (setAsDefault) {
        await this.savedPaymentMethodRepository.update(
          { userId, isDefault: true },
          { isDefault: false },
        );
      }

      const paymentMethod = await this.stripe.paymentMethods.retrieve(paymentMethodId);

      const savedMethod = this.savedPaymentMethodRepository.create({
        userId,
        type: 'card',
        nickname,
        stripePaymentMethodId: paymentMethodId,
        last4: (paymentMethod.card?.last4),
        brand: paymentMethod.card?.brand,
        expiryMonth: paymentMethod.card?.exp_month,
        expiryYear: paymentMethod.card?.exp_year,
        isDefault: setAsDefault || false,
      });

      return await this.savedPaymentMethodRepository.save(savedMethod);
    } catch (error) {
      throw new InternalServerErrorException('Failed to save payment method');
    }
  }

  /**
   * Delete a saved payment method
   */
  async deletePaymentMethod(paymentMethodId: string): Promise<void> {
    try {
      await this.stripe.paymentMethods.detach(paymentMethodId);
      await this.savedPaymentMethodRepository.delete({ stripePaymentMethodId: paymentMethodId });
    } catch (error) {
      throw new InternalServerErrorException('Failed to delete payment method');
    }
  }

  /**
   * Refund a Stripe payment
   */
  async refundPayment(paymentId: string, amount?: number): Promise<PaymentRefund> {
    try {
      const payment = await this.paymentRepository.findOne({ where: { id: paymentId } });

      if (!payment?.stripeChargeId) {
        throw new BadRequestException('Payment cannot be refunded');
      }

      const refundAmount = amount ? Math.round(amount * 100) : undefined;

      const refund = await this.stripe.refunds.create({
        charge: payment.stripeChargeId,
        amount: refundAmount,
        metadata: {
          paymentId,
        },
      });

      const paymentRefund = this.refundRepository.create({
        paymentId,
        type: refundAmount ? 'partial' : 'full',
        status: RefundStatus.PROCESSING,
        amount: amount || (Number(payment.amount) / 100),
        stripeRefundId: refund.id,
        providerResponse: JSON.parse(JSON.stringify(refund)),
      });

      return await this.refundRepository.save(paymentRefund);
    } catch (error) {
      if (error instanceof Stripe.errors.StripeError) {
        throw new BadRequestException(`Stripe error: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Verify a Stripe webhook signature
   */
  verifyWebhookSignature(body: string, signature: string): boolean {
    try {
      this.stripe.webhooks.constructEvent(
        body,
        signature,
        this.configService.get('STRIPE_WEBHOOK_SECRET'),
      );
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get payment from Stripe payment intent ID
   */
  async getPaymentByIntentId(paymentIntentId: string): Promise<Payment | null> {
    return this.paymentRepository.findOne({
      where: { stripePaymentIntentId: paymentIntentId },
    });
  }

  /**
   * List Stripe charges for a customer
   */
  async listCustomerCharges(customerId: string, limit: number = 10): Promise<Stripe.Charge[]> {
    const charges = await this.stripe.charges.list({
      customer: customerId,
      limit,
    });
    return charges.data;
  }
}
