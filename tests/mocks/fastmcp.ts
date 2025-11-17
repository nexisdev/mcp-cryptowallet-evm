export class FastMCP {
  constructor(_options?: Record<string, unknown>) {}
  addTool(): void {}
  addPrompt(): void {}
  async start(): Promise<void> {}
}

export class UserError extends Error {
  extras?: Record<string, unknown>;
  constructor(message: string, extras?: Record<string, unknown>) {
    super(message);
    this.extras = extras;
  }
}

export type Context<T = Record<string, unknown>> = {
  client: {
    version: unknown;
  };
  log: {
    debug: (message: string, data?: unknown) => void;
    error: (message: string, data?: unknown) => void;
    info: (message: string, data?: unknown) => void;
    warn: (message: string, data?: unknown) => void;
  };
  reportProgress: (progress: unknown) => Promise<void>;
  requestId?: string;
  session?: T;
  sessionId?: string;
  streamContent: (content: unknown) => Promise<void>;
};

export type ToolParameters = unknown;
export type Tool = unknown;

