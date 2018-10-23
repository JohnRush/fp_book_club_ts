export type Option<A> = Some<A> | None<A>;

abstract class OptionBase<A> {
  filter(this: Option<A>, p: (a: A) => boolean): Option<A> {
    throw new Error("Not implemented");
  }

  flatMap<B>(this: Option<A>, f: (a: A) => Option<B>): Option<B> {
    throw new Error("Not implemented");
  }

  getOrElse<T extends U, U>(this: Option<T>, onEmpty: () => U): U {
    if (this.tag === "some") return this.value;
    return onEmpty();
  }

  map<B>(this: Option<A>, f: (a: A) => B): Option<B> {
    if (this.tag === "none") return NONE;
    return new Some(f(this.value));
  }

  orElse<T extends U, U>(this: Option<T>, ou: () => Option<U>): Option<U> {
    throw new Error("Not implemented");
  }
}

export class Some<A> extends OptionBase<A> {
  readonly tag: "some" = "some";
  readonly value: A;

  constructor(value: A) {
    super();
    this.value = value;
  }
}

export class None<A> extends OptionBase<A> {
  readonly tag: "none" = "none";
}

export const NONE: Option<never> = new None();
