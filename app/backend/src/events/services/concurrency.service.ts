import { Injectable } from '@nestjs/common';
import { ConflictException } from '@nestjs/common';

@Injectable()
export class ConcurrencyService {
  generateToken(): string {
    return Math.random().toString(36).substring(2, 15) + 
           Math.random().toString(36).substring(2, 15);
  }

  validateConcurrencyToken(currentToken: string, providedToken: string): void {
    if (currentToken !== providedToken) {
      throw new ConflictException('Concurrent modification detected. Please refresh and try again.');
    }
  }

  updateConcurrencyToken(token: string): string {
    return this.generateToken();
  }
}