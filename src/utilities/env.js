export const IS_NODE = typeof process !== 'undefined' && process?.versions?.node;
export const IS_BROWSER = !IS_NODE;
export const ENV = IS_NODE ? "node" : "browser";