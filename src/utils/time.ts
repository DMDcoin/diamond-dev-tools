

export function sleep(milliseconds: number) {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

/// checks the condition every `milliseconds` milliseconds until it returns true.
export async function spoolWait(milliseconds: number, condition: () => Promise<boolean>) {

  while (!await condition()) {
    await sleep(milliseconds);
  }
  
}