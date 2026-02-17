export interface VerificationResult {
  success: boolean;
  error?: string;
  errorCode?: string;
  details?: {
    tweetId?: string;
    username?: string;
  };
}

export interface VerifierConfig {
  timeout: number;
}

export abstract class BaseProofVerifier {
  protected config: VerifierConfig;

  constructor(config?: Partial<VerifierConfig>) {
    this.config = {
      timeout: config?.timeout || 10000,
    };
  }

  abstract getServiceName(): string;
  abstract validateProofUrl(proofUrl: string): boolean;
  abstract normalizeHandle(handle: string): string;
  abstract verify(
    proofUrl: string,
    expectedChallenge: string,
    handle: string,
  ): Promise<VerificationResult>;
}
