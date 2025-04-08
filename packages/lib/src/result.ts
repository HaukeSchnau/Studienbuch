export type Result<T, E> = Result.Ok<T> | Result.Err<E>;

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace Result {
  export interface Ok<T> {
    _tag: "ok";
    value: T;
  }

  export interface Err<E> {
    _tag: "err";
    error: E;
  }

  export function ok<T>(value: T): Ok<T> {
    return {
      _tag: "ok",
      value,
    };
  }

  export function err<E>(error: E): Err<E> {
    return {
      _tag: "err",
      error,
    };
  }

  export function isOk<T>(result: Result<T, unknown>): result is Ok<T> {
    return result._tag === "ok";
  }

  export function isErr<E>(result: Result<unknown, E>): result is Err<E> {
    return result._tag === "err";
  }
}
