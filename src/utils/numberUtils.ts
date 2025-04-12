import BigNumber from "bignumber.js";


export function toNumber(value: string | number): number {
    if (typeof value === "number") {
        return value;
    }

    if (typeof value === "string") {
        return Number.parseInt(value);
    }

    throw Error('not a number');

}

// Hex string to number
export function h2n(hexString: string): number {
    return new BigNumber(hexString).toNumber();
  }
  
export function h2bn(hexString: string): BigNumber {
    return new BigNumber(hexString);
  }
  

export function toDate(value: string | number): Date {
    return new Date(toNumber(value) * 1000);
}