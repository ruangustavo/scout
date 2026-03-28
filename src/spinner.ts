const FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
const INTERVAL_MS = 80;

export interface Spinner {
  stop(): void;
}

export interface SpinnerStream {
  write(text: string): boolean;
}

export function createSpinner(message: string, stream: SpinnerStream = process.stdout): Spinner {
  let index = 0;
  const timer = setInterval(() => {
    stream.write(`\r${FRAMES[index++ % FRAMES.length]} ${message}`);
  }, INTERVAL_MS);

  return {
    stop() {
      clearInterval(timer);
      const blank = " ".repeat(message.length + 2);
      stream.write(`\r${blank}\r`);
    },
  };
}
