import {
  Controller,
  Post,
  Body,
  Headers,
  InternalServerErrorException,
  BadRequestException,
  RawBodyRequest,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import Stripe from 'stripe';
import { ConfigService } from '@nestjs/config';
import { Payment, PaymentStatus } from '../entities/payment.entity';
import { PaymentWebhook, WebhookProvider, WebhookStatus } from '../entities/payment-webhook.entity';
import { PaymentRefund, RefundStatus } from '../entities/payment-refund.entity';
import { StripeService } from '../services/stripe.service';

@Controller('webhooks/payments')
export class PaymentWebhookController {
  constructor(
    private configService: ConfigService,
    private stripeService: StripeService,
    @InjectRepository(Payment)
    private paymentRepository: Repository<Payment>,
    @InjectRepository(PaymentWebhook)
    private webhookRepository: Repository<PaymentWebhook>,
    @InjectRepository(PaymentRefund)
    private refundRepository: Repository<PaymentRefund>,
  ) {}

  /**
   * Handle Stripe webhooks
   */
  @Post('stripe')
  async handleStripeWebhook(@Req() request: RawBodyRequest<Request>): Promise<{ received: boolean }> {
    const sig = request.headers['stripe-signature'] as string;
    const body = request.rawBody;

    if (!sig || !body) {
      throw new BadRequestException('Missing Stripe signature or body');
    }

    // Verify webhook signature
    const isValid = this.stripeService.verifyWebhookSignature(body.toString(), sig);

    if (!isValid) {
      throw new BadRequestException('Invalid Stripe signature');
    }

    let event: Stripe.Event;

    try {
      const stripe = new Stripe(this.configService.get('STRIPE_SECRET_KEY'), {
        apiVersion: '2024-04-10',
      });

      event = stripe.webhooks.constructEvent(
        body.toString(),
        sig,
        this.configService.get('STRIPE_WEBHOOK_SECRET'),
      );
    } catch (error) {
      throw new BadRequestException(`Webhook error: ${error.message}`);
    }

    // Process webhook asynchronously
    this.processStripeWebhook(event).catch((error) => {
      console.error('Failed to process Stripe webhook:', error);
    });

    return { received: true };
  }

  /**
   * Process Stripe webhook event
   */
  private async processStripeWebhook(event: Stripe.Event): Promise<void> {
    try {
      // Store webhook record
      const webhook = this.webhookRepository.create({
        provider: WebhookProvider.STRIPE,
        externalId: event.id,
        eventType: event.type,
        payload: event.data.object,
        signature: '', // Already verified
        signatureVerified: true,
        status: WebhookStatus.PROCESSING,
      });

      await this.webhookRepository.save(webhook);

      // Handle different event types
      switch (event.type) {
        case 'payment_intent.succeeded':
          await this.handlePaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent, webhook);
          break;

        case 'payment_intent.payment_failed':
          await this.handlePaymentIntentFailed(event.data.object as Stripe.PaymentIntent, webhook);
          break;

        case 'charge.refunded':
          await this.handleChargeRefunded(event.data.object as Stripe.Charge, webhook);
          break;

        case 'charge.dispute.created':
          await this.handleChargeDispute(event.data.object as Stripe.Dispute, webhook);
          break;

        default:
          webhook.status = WebhookStatus.SKIPPED;
          break;
      }

      if (webhook.status !== WebhookStatus.SKIPPED) {
        webhook.status = WebhookStatus.PROCESSED;
        webhook.processedAt = new Date();
      }

      await this.webhookRepository.save(webhook);
    } catch (error) {
      console.error('Error processing Stripe webhook:', error);
      throw error;
    }
  }

  /**
   * Handle payment intent succeeded
   */
  private async handlePaymentIntentSucceeded(
    paymentIntent: Stripe.PaymentIntent,
    webhook: PaymentWebhook,
  ): Promise<void> {
    const payment = await this.paymentRepository.findOne({
      where: { stripePaymentIntentId: paymentIntent.id },
    });

    if (payment) {
      payment.status = PaymentStatus.SUCCEEDED;
      payment.stripeChargeId = paymentIntent.latest_charge as string;
      payment.webhookProcessed = true;
      payment.webhookProcessedAt = new Date();
      payment.providerResponse = JSON.parse(JSON.stringify(paymentIntent));

      await this.paymentRepository.save(payment);
      webhook.paymentId = payment.id;
    }
  }

  /**
   * Handle payment intent failed
   */
  private async handlePaymentIntentFailed(
    paymentIntent: Stripe.PaymentIntent,
    webhook: PaymentWebhook,
  ): Promise<void> {
    const payment = await this.paymentRepository.findOne({
      where: { stripePaymentIntentId: paymentIntent.id },
    });

    if (payment) {
      payment.status = PaymentStatus.FAILED;
      payment.errorCode = (paymentIntent.last_payment_error?.code) || 'unknown';
      payment.errorMessage = paymentIntent.last_payment_error?.message || 'Payment failed';
      payment.webhookProcessed = true;
      payment.webhookProcessedAt = new Date();
      payment.providerResponse = JSON.parse(JSON.stringify(paymentIntent));

      await this.paymentRepository.save(payment);
      webhook.paymentId = payment.id;
    }
  }

  /**
   * Handle charge refunded
   */
  private async handleChargeRefunded(charge: Stripe.Charge, webhook: PaymentWebhook): Promise<void> {
    const payment = await this.paymentRepository.findOne({
      where: { stripeChargeId: charge.id },
    });

    if (payment && charge.refunds.total_count > 0) {
      const refund = charge.refunds.data[charge.refunds.data.length - 1];

      if (refund) {
        const paymentRefund = await this.refundRepository.findOne({
          where: { stripeRefundId: refund.id },
        });

        if (paymentRefund) {
          paymentRefund.status = RefundStatus.SUCCEEDED;
          paymentRefund.processedAt = new Date();
          paymentRefund.webhookProcessed = true;
          paymentRefund.webhookProcessedAt = new Date();

          await this.refundRepository.save(paymentRefund);

          // Update payment refunded amount
          payment.refundedAmount = (charge.amount_refunded || 0) / 100;

          if (payment.refundedAmount >= payment.amountDisplayValue) {
            payment.status = PaymentStatus.REFUNDED;
          } else {
            payment.status = PaymentStatus.PARTIALLY_REFUNDED;
          }

          await this.paymentRepository.save(payment);
          webhook.paymentId = payment.id;
        }
      }
    }
  }

  /**
   * Handle charge dispute
   */
  private async handleChargeDispute(dispute: Stripe.Dispute, webhook: PaymentWebhook): Promise<void> {
    const payment = await this.paymentRepository.findOne({
      where: { stripeChargeId: dispute.charge as string },
    });

    if (payment) {
      // Update payment with dispute information
      payment.errorCode = 'dispute';
      payment.errorMessage = `Chargeback dispute: ${dispute.reason}`;
      payment.providerResponse = JSON.parse(JSON.stringify(dispute));

      await this.paymentRepository.save(payment);
      webhook.paymentId = payment.id;
    }
  }

  /**
   * Handle blockchain/crypto webhooks (can come from Alchemy, etc.)
   */
  @Post('blockchain')
  async handleBlockchainWebhook(@Body() body: any): Promise<{ received: boolean }> {
    // This is a placeholder for blockchain webhooks
    // Implementation depends on your blockchain event provider

    const webhook = this.webhookRepository.create({
      provider: WebhookProvider.BLOCKCHAIN,
      externalId: body.id || 'unknown',
      eventType: body.type || 'transaction.confirmed',
      payload: body,
      signature: '',
      signatureVerified: true,
      status: WebhookStatus.PENDING,
    });

    await this.webhookRepository.save(webhook);

    // Process asynchronously
    this.processBlockchainWebhook(body, webhook).catch((error) => {
      console.error('Failed to process blockchain webhook:', error);
    });

    return { received: true };
  }

  /**
   * Process blockchain webhook
   */
  private async processBlockchainWebhook(body: any, webhook: PaymentWebhook): Promise<void> {
    try {
      // Find payment by transaction hash
      if (body.transaction?.hash) {
        const payment = await this.paymentRepository.findOne({
          where: { transactionHash: body.transaction.hash },
        });

        if (payment) {
          payment.blockConfirmations = body.transaction?.confirmations || 0;
          payment.blockNumber = body.transaction?.blockNumber;

          if (payment.blockConfirmations >= 12) {
            payment.status = PaymentStatus.SUCCEEDED;
            payment.webhookProcessed = true;
            payment.webhookProcessedAt = new Date();
          }

          await this.paymentRepository.save(payment);
          webhook.paymentId = payment.id;
        }
      }

      webhook.status = WebhookStatus.PROCESSED;
      webhook.processedAt = new Date();
      await this.webhookRepository.save(webhook);
    } catch (error) {
      webhook.status = WebhookStatus.FAILED;
      webhook.errorMessage = error.message;
      await this.webhookRepository.save(webhook);
      throw error;
    }
  }

  /**
   * Health check for webhook endpoint
   */
  @Post('health')
  health(): { status: string } {
    return { status: 'webhook handler is operational' };
  }
}
