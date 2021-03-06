# Chapter 4. Handling errors without exceptions

Exceptions, as mentioned in [Chapter 1](chapter_1.html), are not a great fit for functional programming for a couple
reasons:

1. They break referential transparency (RT).
2. They are not type-safe: the type of a function says nothing about whether or not it can throw an exception, so the
   compiler loses some ability to enforce correctness.

Exceptions *do* have an upside, in that they allow the programmer to consolidate error-handling logic.

In this chapter, we'll learn how to use types to encode failures and error conditions, so that we can capture them as
ordinary values. This lets us keep our FP principles intact while maintaining the benefit of error-handling
consolidation.

## Possible alternatives to exceptions

Consider this example, which computes the mean of a list:

```typescript
const mean = (xs: List<number>): number => {
  if (xs.tag === "nil")
    throw new Error("Attempt to take mean of empty list");

  return sum(xs) / length(xs);
};
```

It's a *partial function*, which means its result is undefined for some input values. Throwing an exception is one way
of handling these values, but there are others:

We could return a special value, like `NaN` (which is TypeScript for "not a number") or `null`, but there are several
drawbacks to this approach.

* Makes it easy for errors to proliferate due to callers neglecting to check for this special value
* Creates need for boilerplate error checking code
* Doesn't work with polymorphic code. For some input types, there may not be an appropriate special value to return
* Forces a special policy on callers, who can't simply call the function and use the result, which makes it difficult
  to compose `mean` with other functions

We could change `mean`'s API and force the caller to provide the value to return for empty lists, like this:

```typescript
const mean = (xs: List<number>, onEmpty: number): number => {
  if (xs.tag === "nil")
    return onEmpty;

  return sum(xs) / length(xs);
};
```

But this requires immediate callers to have knowledge of how to handle the special cases, again making it difficult to
compose the function into a larger computation, and limiting the freedom the caller has to decide how to handle special
cases.

## The `Option` data type

A functional solution to this problem is to encode into the function's return type the possibility of not returning a
value. Behold, the `Option` type!

```typescript
type Option<A> = Some<A> | None<A>;

class Some<A> {
  readonly tag: "some" = "some";

  constructor(readonly value: A) { }
}

class None<A> {
  readonly tag: "none" = "none";
}
```

`Option`, like `List`, has one type parameter, which is the type of value that it might contain. An `Option` can be
either `Some`, meaning it definitely has a value, or `None` meaning the value is not defined.

Where as `List` represents the idea that multiple values of a type may exist, `Option` represents the idea that a value
may not exist at all. In FP, both of these notions are examples of *effects* (which are distinct from *side effects*).
`List` models the effect of having multiple values; `Option` models the effect of optionality.

We can use `Option` to rewrite `mean` as a *total function*:

```typescript
const mean = (xs: List<number>): Option<number> => {
  if (xs.tag === "nil")
    return NONE;

  return new Some(sum(xs) / length(xs));
};
```

It now always has a defined result, which is `None` when the input list is empty.

### Usage patterns for `Option`

`Option` is convenient because we can factor out common error-handling patterns into higher-order functions, meaning we
can dispense with much of the boilerplate that comes with exception-oriented code.

#### Basic functions on Option

We're going to use a different style of function definition than we used with `List`, where we placed all our functions
at the top level of the module and exported each of them. Here, when possible, we'll place the functions "inside" our
`Option` type, so they can be called with an object-oriented style of syntax (e.g. `opt.map(a => a.toString())` instead
of `map(opt, a => a.toString())`). In order to accomplish that, we need to introduce a few new bits of TypeScript
syntax. Examine this expanded definition of `Option`:

```typescript
export type Option<A> = Some<A> | None<A>;

// 1. `abstract class` defines class that cannot be instantiated
abstract class OptionBase<A> {

  // 2. `this` parameter
  map<B>(this: Option<A>, f: (a: A) => B): Option<B> { ... }

  // 3. `extends` keyword introducing type bound
  // 4. `() => U` function type is a "thunk"
  getOrElse<T extends U, U>(this: Option<T>, onNone: () => U): U { ... }

  filter(this: Option<A>, p: (a: A) => boolean): Option<A> { ... }
  flatMap<B>(this: Option<A>, f: (a: A) => Option<B>): Option<B> { ... }
  orElse<T extends U, U>(this: Option<T>, ou: () => Option<U>) { ... }
}

// 5. `extends` keyword creating inheritance relationship
export class Some<A> extends OptionBase<A> {
  readonly tag: "some" = "some";

  // 6. classes must call `super()` if they extend other classes
  constructor(readonly value: A) {
    super();
  }
}

export class None<A> extends OptionBase<A> {
  // 7. `never` is the "bottom type"
  // 8. `static` creates "class" property
  static readonly NONE: Option<never> = new None();

  readonly tag: "none" = "none";

  // 9. `private` prevents access by external code
  private constructor() {
    super();
  }
}

// 10. smart constructors for `None` and `Some`
export const none = <A>(): Option<A> => None.NONE;

export const some = <A>(a: A): Option<A> => new Some(a);
```

#### 1. Abstract classes

As we said, we want to place our functions "inside" the `Option` type. But, since `Option` is just a union type
comprising two otherwise unrelated types, how do we accomplish that? Where is the common place to put our functions?
TypeScript provides an *abstract class* for this purpose, which is a class that cannot be directly instantiated. Rather,
it must be *extended* by a normal, or *concrete*, class (more on that later). This is exactly what we're looking for,
since we do not want to add another data constructor to our `Option` type, but do want the ability to define our
functions once and still have them be usable from both `Some` and `None` values. Note that we are not exporting
`OptionBase` to users of our `Option` module. As an implementation detail, we want the freedom to change `OptionBase` as
needed, so it's best to keep it private to the module, to prevent accidental dependencies on a part of our code that's
likely to change.

#### 2. `This` parameters

In many object-oriented languages, defining a method on a class is really a shorthand for defining a function that
takes, as a parameter, an instance of the method's containing class. Inside the method, this undeclared parameter is
often called `this`. TypeScript is no different. For example, this code fragment...

```typescript
class OptionBase<A> {
  filter(p: (a: A) => boolean): Option<A> { ... }
}
```

...is equivalent to this:

```typescript
class OptionBase<A> {
  filter(this: OptionBase<A>, p: (a: A) => boolean): Option<A> { ... }
}
```

As you can see, the implicit `this` parameter has type `OptionBase<A>`. Many other object-oriented languages give us no
further control over `this`. We get a parameter whose type matches that of the enclosing class, and that's that. But
TypeScript allows us to explicitly declare the `this` parameter and give it an arbitrary type. So the previous snippet
is actually valid TypeScript code.

::: tip JavaScript's "this" value
TypeScript's mission is to remain a strict superset of JavaScript. Therefore, its type system is uniquely shaped to
provide type information on top of existing JavaScript code. JavaScript is object-oriented, but does not have classes,
and therefore has a number of idiosyncrasies around its treatment of the `this` value inside functions. One of the most
impactful of these is that `this` can be dynamically assigned at runtime. For more about JavaScript's `this` value and
how TypeScript's `this` parameters address it from a static typing perspective, see ["Understanding JavaScript Function
Invocation and `this`"][js_this] by Yehuda Katz and [the "Functions" section of the TypeScript Handbook][ts_fns].
:::

The reason we need to include a `this` parameter in the method signatures of our `OptionBase` is that we want to take
advantage of the compiler help we get when using tagged unions (which we discussed in [Chapter 3][ch_3_adt]). Because
`OptionBase` is an abstract class, it is open to be extended by other concrete classes beyond our `Some` and `None`.
That means the TypeScript compiler can never know all the possible types that can be an `OptionBase`, which defeats our
tagged union structure. The workaround is to fix the type of `this` in our methods to `Option`, which is our tagged
union type and therefore closed to additions. Doing so makes attempting to call our `OptionBase` methods on anything
other than a `Some` or `None` a compile error.

#### 3. Type bounds

Our `Option` module uses the `extends` keyword in two separate but related ways. The first is in the parameter lists of
`getOrElse` and `orElse`. In a type parameter list, the syntax `<T extends U, U>` declares two type parameters and a
relationship between them in which `T` must be equal to or a subtype of `U`. This is known as a *type bound*,
specifically an *upper type bound*. The right hand side of the `extends` keyword need not be another type variable, but
could be a concrete type, as in `<T extends string>`.

So why do we need this? Bear with me, this is a bit of a long explanation. First, we need to talk about *variance*.
Variance, in this context, refers to how the relationship between types that might be substituted for type parameters
affects the relationship between instances of generic types. Consider the following class hierarchy:

```typescript
class Pet {
  name: string;
}

class Fish extends Pet { }

class Dog extends Pet {
  breed: string;
}
```

In this snippet, `Fish` and `Dog` are subtypes of `Pet` (we still haven't explained what `extends` means when used like
this, but hopefully the meaning is starting to become clear). What does that say about the relationship between
`Option<Pet>` and `Option<Fish>`? Well, that depends on the *variance* of `Option`. There are three possibilities,
called *covariance*, *contravariance*, and *invariance*:

* If `Option<Fish>` is a subtype of `Option<Pet>`, we say that `Option` is *covariant*.
* If `Option<Fish>` is a supertype of `Option<Pet>` (i.e. the relationship is reversed), we say that `Option` is
  *contravariant*.
* If `Option<Fish>` is neither a subtype nor a supertype of `Option<Pet>` (i.e. there is no relationship and one cannot
  be used where the other is expected), we say that `Option` is *invariant*.

In TypeScript, generic classes are covariant: an instance of `Option<Fish>` can be used wherever an `Option<Pet>` is
expected. Functions are bit more complicated: they are covariant in their return type, but contravariant in their
argument types. To understand why, consider the `map` function of `Option`. It expects a function that takes a parameter
of type `A` and returns a value of type `B`. Let's assume that `A` and `B` have been resolved to `Pet` and `string`,
respectively. The code below is simplified and does not include a `this` parameter, which doesn't impact this
discussion:

```typescript
map<string>(f: (a: Pet) => string): Option<string>
```

It's clear that the `f` we pass to `map` can return a `string` or any subtype of `string`, since the calling code can
deal with the result as though it were a `string` without caring about its finer-grained type. But `f` must be able to
accept a `Pet` value. If we attempt to pass a function that requires something more specific, like a `Dog`, we might run
into trouble. Our function might, for example, try to access the `breed` property, which isn't guaranteed to exist for
all `Pet`s. Thus, the only way to ensure type safety is to require `f` to accept a `Pet` *or any supertype of* `Pet`,
demonstrating that functions are contravariant in their argument types.

OK, we're almost there. We know what variance is, and we know what type bounds are. So what does this have to do with
`orElse` and `getOrElse`? Let's look again at the signature of `getOrElse`.

```typescript
getOrElse<T extends U, U>(this: Option<T>, onEmpty: () => U): U
```

Recall that `OptionBase` has one type parameter, `A`. But why doesn't `A` show up in `getOrElse`? Well, it's all
`None`'s fault. `None` extends `OptionBase<never>`. We haven't talked about this yet, but `never` is the so-called
*bottom type* in TypeScript, representing the type of expressions that either are never evaluated or never return. It's
called the bottom type because it is a subtype of every other type. One of the rules of `never` is that values of type
`never` are only assignable to variables of type `never`.

Remember `mean`? It results in an `Option<number>`, which could be either a `Some<number>` or a `None`. Say we want to
execute this snippet:

```typescript
const vals = ...;
const avg: number = mean(vals).getOrElse(() => -1);
```

 Now, imagine that `getOrElse` didn't have any fancy extra type parameters, instead just using the base type's `A`
parameter, like so:

```typescript
getOrElse(this: Option<A>, onEmpty: () => A): A
```

 If `vals` in the above fragment contained a non-empty list, `mean` would return a `Some<number>`, and `getOrElse` would
return the contained number. But, if `vals` were an empty list, then we'd end up with a `None`, and `getOrElse` would
return a value of type `never`. By the rule of `never` we discussed earlier, we cannot assign a `never` value to
variable of type `number`, and we end up with a compile error. We need a way to specify that `getOrElse` returns a
supertype of `A`. Since everything is a supertype of `never`, this would work for the `None` case. In other words, we
need to specify a new type parameter whose *lower bound* is `A`.

TypeScript does not have direct syntax for defining lower bounds, but it is possible to do so when we can express the
lower bound as an inverted upper bound. Look back at the real `getOrElse`. The type parameter list, `<T extends U, U>`,
establishes `U` as the upper bound of `T`. We can also say that `T` is the lower bound of `U`. Now, we just need to
relate `A` to `T` and `U` somehow. The `this` parameter, `this: Option<T>`, effectively makes `T` an alias of `A`.
Voila! We have established `A` as the lower bound of `U`.

Returning to our example snippet, if `mean` returns `None`, then `A` is resolved to `never`, but `U` in `getOrElse` is
resolved to `number` because of the function we pass in to provide the default value: `() => -1`. This works because
`number` is a supertype of `never`. That means the whole expression returns a value of type `number`, and we have
restored type safety!

Whew! That took a while. Don't worry if this stuff about variance isn't immediately clear to you. As long as you can
follow the types in the given function signatures, you'll still be able to understand this chapter and complete the
exercises. Also, check out the [online notes about variance][fpis_var] for *Functional Programming in Scala*.

#### 4. Thunks

It would be advantageous if the default values provided to `getOrElse` and `orElse` were not evaluated unless they had
to be. In other words, we'd like them to be *lazily evaluated*. TypeScript does not provide an explicit mechanism for
lazy evaluation (we'll talk more about this in [Chapter 5](chapter_5.html)). But, a common technique in FP to achieve the
effect of lazy evaluation is to accept, instead of a value, a function that returns a value of the needed type. Such a
function is called a *thunk*, and you'll see them often throughout these notes.

#### 5. Inheritance

Finally, we come to the use of `extends` in the definition of the `Some` and `None` classes, which both extend
`OptionBase`. This sets up an inheritance relationship, meaning that `Some` and `None` *inherit* methods and properties
defined on `OptionBase`.

#### 6. super()

We'll try to use class hierarchies sparingly throughout these notes. This is in no small part because defining
inheritance relationships between classes creates a rigid, inflexible linkage and requires some boilerplate code. For
example, classes that extend other classes must call `super()` if they define a constructor, which invokes the
constructor of the superclass. This ensures that required properties in the superclass have been defined before the
subclass attempts to access them.

#### 7. The bottom type

We've already encountered `never` in our journey to understand variance. There's not much more to say here, except that
we'll see `never` used in the future, as it is here, to collapse possibilities. Since `None` cannot hold a value, it
makes sense for it not to have a type parameter. But, because it extends `OptionBase`, it must either declare a type
parameter and "pass it on" to `OptionBase`, or extend `OptionBase` with a specific type. Our final solution is a bit of
a compromise. We give the class `None` a type parameter and then declare a constant, `NONE`, of type `Option<never>`.
Whenever we return a `None`, we'll return this value. The type parameter on `None` is necessary for the compiler to
understand, in some cases, that the `OptionBase` methods are compatible with both `Some` and `None`.

#### 8. `static` properties

A property marked `static` has a different lifetime than the other properties (a.k.a. *instance properties*) of a class.
It has the same lifetime as the class definition itself. In other words, all instances of `None` share the same value
for their `NONE` property. The `None.NONE` property is an implementation of the [singleton pattern][wp_single] of
object-oriented programming.

#### 9. `private` properties and methods

A property or method of a class marked as `private` can only be accessed by code within the same class. We want to
expose just one value of type `None` to clients of our `Option` module, in part as an optimization. To get the compiler
to help us enforce this constraint, we mark the constructor of `None` as `private`, making it difficult for clients to
create new `None` values.

#### 10. Smart constructors

*Smart constructors* encapsulate the logic of creating new values using our data constructors. As we said, we only want
clients to use our predefined singleton `None` value, rather than creating their own. To make it easier, we offer this
`none()` smart constructor, which simply returns the singleton. By convention, the names of smart constructors typically
mirror those of their corresponding data constructors, but with lowercase initial letters. It's easier to tell clients
to just use the function to get `None` values, rather than having them always use the `None.NONE` reference. For the
sake of symmetry, and allowing clients to omit a number of `new` invocations, we also provide a `some()` smart
constructor. Using these functions, which are annotated with a return type of `Option<A>`, also helps the compiler make
better type inferences.

### Exercise 4.1. Implement `Option` functions

Implement the five functions declared on `OptionBase`: `map`, `getOrElse`, `filter`, `flatMap`, and `orElse`.

* It's fine to use our pattern-matching approximation and directly examine whether `this` is `Some` or `None`, but you
  should really only need to do that in `map` and `getOrElse`. All the other functions should be expressible in terms of
  `map`, `getOrElse`, and each other.
* The type signatures of `map` and `flatMap` should be enough to guide their implementation.
* `getOrElse` returns the contained value of a `Some`, or the value returned by the thunk in case of a `None`.
* `orElse` is similar to `getOrElse`, but the return type of the thunk, and of itself, is `Option`.

??? answer
``` typescript
abstract class OptionBase<A> {

  filter(this: Option<A>, p: (a: A) => boolean): Option<A> {
    return this.flatMap(a => p(a) ? some(a) : none());
  }

  flatMap<B>(this: Option<A>, f: (a: A) => Option<B>): Option<B> {
    return this.map(f).getOrElse(() => none());
  }

  getOrElse<T extends U, U>(this: Option<T>, onEmpty: () => U): U {
    if (this.tag === "none") return onEmpty();
    return this.value;
  }

  map<B>(this: Option<A>, f: (a: A) => B): Option<B> {
    if (this.tag === "none") return none();
    return some(f(this.value));
  }

  orElse<T extends U, U>(this: Option<T>, ou: () => Option<U>): Option<U> {
    return this.map(a => some(a)).getOrElse(() => ou());
  }
}
```
???

#### When to use the basic Option functions

When working with `Option` values, we can always explicity test for `Some` vs. `None` and act accordingly. But usually,
we'll use the higher-order functions you implemented in the first exercise of this chapter. These allow us to build up
complex executions using `Option`s without having to sprinkle our code with `if`-checks, and defer error-handling to the
end.

Let's look at a few examples, using the following snippet of a human resources application:

```typescript
class Employee {
  name: string;
  department: string;
  manager: Option<Employee>
}

const lookupByName = (name: string): Option<Employee> => { ... };
```

To look up an employee named Joe, and if he exists, get his department, we could write:

```typescript
let joeDept: Option<string>;
const joe = lookupByName("Joe");
if (joe.tag === "some")
  joeDept = new Some(joe.value);
else
  joeDept = NONE;
```

But this is exactly what `map` does for us. It's much simpler to write:

```typescript
const joeDept = lookupByName("Joe").map(emp => emp.department);
```

We achieve the same result: `joeDept` is a `Some<string>` if Joe exists, and a `None` if not. The code to extract Joe's
department only runs in the `Some` case. Note that we also did away with the need for intermediate mutable state. Here
are some other ways we can compose these functions together:

```typescript
// `Some(manager)` if Joe exists and has a manager
// `None` if Joe doesn't exist or doesn't have a manager
lookupByName("Joe").flatMap(emp => emp.manager);

// Joe's department if he exists
// "Default Dept." if not
lookupByName("Joe").map(emp => emp.department).getOrElse("Default Dept.");
```

### Exercise 4.2. Implement `variance` in terms of `flatMap`

Implement a `variance` function using Option's `flatMap`. The variance of a set of numbers is the average of the square
of each element's distance from the set's mean. You can use the formula `Math.pow(x - m, 2)` for each element `x` in the
list to calculate the distance, where `m` is the mean of the list.

```typescript
const variance = (xs: List<number>): Option<number> => ...
```

??? answer
```typescript
const variance = (xs: List<number>): Option<number> =>
  mean(xs).flatMap(
    m => mean(map(xs, x => Math.pow(x - m, 2))),
  );
```
???

With `flatMap`, we can build up a computation with multiple stages that will abort as soon as the first failure is
encountered. We can inject `filter` stages to convert successes to failures if any intermediate results don't meet a
particular expectation. These kind of transformation of an `Option` using `map`, `flatMap`, and `filter`, with
`getOrElse` doing error-handling at the end, is a common pattern in FP.

```typescript
const dept: string = lookupByName("Joe")
                       .map(emp => emp.department)
                       .filter(dept => dept != "Accounting")
                       .getOrElse("Default Dept.");
```

`Option` gives us convenient transformations, consolidation of error-handling, *and* an added layer of protection from
mistakes. The compiler will not let us forget to handle the possibility of `None`.

### Option composition, lifting, and wrapping exception-oriented APIs

Although it may seem like `Option` could end up infecting our entire code base, that does not happen in practice due to
our ability to convert easily functions that deal with plain values into functions that operate on `Option`. When we
convert a function this way, we say that we've *lifted* the function into the *context* of `Option`. We could just as
easily lift a function into `List`, or any of the data types we'll explore later in the book.

We already have the ability to lift a function of one argument using `map`:

```typescript
const lift = <A, B>(f: (a: A) => B): (o: Option<A>) => Option<B> =>
  o => o.map(f);
```

We can use `lift` on any function we happen to have lying around to make it compatible with `Option`. For example:

```typescript
const absOpt = lift(Math.abs);
```

We didn't have to rewrite `Math.abs`; we were able to just lift it into the `Option` context *ex post facto*. We can do
this for any function. For example, suppose we're setting up a website for a car insurance company, which includes a
form that users can fill out and submit for an instant rate quote. We'll need to parse the data from the form and call a
function to calculate the rate:

```typescript
const quoteRate = (age: number, numSpeedingTickets: number): number => ...
```

Our function takes two numeric arguments, but we'll only have access to the form data as string values. That means we'll
need to parse the string data into numbers, which isn't guaranteed to succeed. The user might, for example, enter
something like "None of your business" as their age.

Given a `string`, we can attempt to parse it into an integer number with the function `parseInt`. If the `string` does
not represent a valid integer, `parseInt` returns the special value `NaN` (short for *not a number*). You may recall
that returning special values to encode failures puts some undue burden on a function's caller. It would be nice to
convert `parseInt` into an `Option`-based API, which turns out to be fairly easy:

```typescript
const parseIntOpt = (s: string): Option<number> => {
  const i = parseInt(s, 10);
  if (isNaN(i))
    return none();
  else
    return some(i);
};
```

Now we have a convenient way to parse form data into `Option` values. But our `quoteRate` function takes two raw
numbers. How can we lift `quoteRate`, a function with two parameters, into `Option`?

### Exercise 4.3. `map2`

Write a function, `map2`, that combines two `Option`-wrapped values using a provided function. Only when both input
`Option`s are `Some` should `map2` produce a `Some`. Otherwise, it should return `None`. Since the syntax
`optionC = optionA.map2(optionB, f)` feels a little off, let's put `map2` at the top level of our module, rather than
inside `OptionBase`. That leaves us with a more natural-feeling `optionC = map2(optionA, optionB, f)`.

```typescript
const map2 = <A, B, C>(oa: Option<A>,
                       ob: Option<B>,
                       f: (a: A, b: B) => C): Option<C> => ...
```

??? answer
```typescript
const map2 = <A, B, C>(oa: Option<A>,
                              ob: Option<B>,
                              f: (a: A, b: B) => C): Option<C> =>
  oa.flatMap(a => ob.map(b => f(a, b)));
```
???

Now we can use `map2` to lift `quoteRate`:

```typescript
const parseAndQuoteRate =
    (age: string, numSpeedingTickets: string): Option<number> =>
  map2(
      parseIntOpt(age),
      parseIntOpt(numSpeedingTickets),
      quoteRate,
  );
```

With `map2`, we never have to modify an existing function of two arguments to make them "`Option`-aware". As a bonus,
try using `map2` to implement `lift2`. Can you see how to implement `map3`, `map4`, `lift3`, `lift4`, etc.?

### Converting exception-based APIs to `Option`

There are a number of JavaScript APIs that throw exceptions, rather than returning special values like `parseInt`.  For
example, the built-in `decodeURI` function throws a `URIError` if its argument is not a well-formed URI.

```typescript
function encodeURI(uri: string): string
```

We can write a general-purpose function to wrap these exception-throwing APIs inside `Option`-returning equivalents:

```typescript
const Try = <A>(f: () => A): Option<A> => {
  try {
    return some(f());
  } catch (e) {
    return none();
  }
};

const tryEncodeURI = (s: string) => Try(() => encodeURI(s));
```

### Exercise 4.4. `sequence`

Write a function named `sequence` that combines a list of `Options` into a single `Option` containing a list of all the
`Some`-wrapped values in the original list. If any of the original `Options` was a `None`, the function should return
`None`. Otherwise, it should return a `Some` of a list of values. Once again, we should define this at the top level of
the `Option` module. You could argue that it belongs in the `List` module, but there is actually a more abstract data
type we'll introduce later that'll make a good home for `sequence`.

```typescript
const sequence = <A>(a: List<Option<A>>): Option<List<A>> => ...
```

??? answer
```typescript
const sequence = <A>(ls: List<Option<A>>): Option<List<A>> => {
  if (ls.tag === "nil")
    return none();
  else
    return foldRight(
      ls,
      some(List()),
      (oa, ol) => map2(ol, oa, (la, a) => new Cons(a, la)),
    );
};
```
???


Sometimes, we'll want to first apply a function that might fail to a list of simple values, and then `sequence` over the
resulting list of `Option`s. For example, we might want to attempt to parse a list of integers out of a list of strings.
To accomplish this, we could first `map` over the list and then call `sequence`:

```typescript
const parseInts = (a: List<string>): Option<List<number>> =>
  sequence(map(a, parseIntOpt));
```

But this is inefficient, because we loop over the list twice: once to apply `parseIntOpt`, and once to `sequence` the
result into a single `Option`. This is a fairly common thing to want to do, so let's create a more optimized function to
accomplish it.

### Exercise 4.5. `traverse`

Write the `traverse` function, which `sequences` a list of values, applying a mapping function to each value in-line.
It's easy to write this function in terms of `map` and `sequence`, but the whole point of the exercise is to find a more
efficient implementaiton. To test yourself, implement `sequence` in terms of `traverse`.

```typescript
const traverse = <A, B>(a: List<A>,
                        f: (a: A) => Option<B>): Option<List<B>> => ...
```

??? answer
```typescript
const traverse = <A, B>(ls: List<A>,
                        f: (a: A) => Option<B>): Option<List<B>> => {
  if (ls.tag === "nil")
    return none();
  else
    return foldRight(
      ls,
      some(List()),
      (a, ol) => map2(ol, f(a), (la, b) => new Cons(b, la)),
    );
};

const sequence = <A>(ls: List<Option<A>>): Option<List<A>> => traverse(ls, oa => oa);
```
???

## The `Either` data type

`Option` is cool, but using it for representing error conditions is problematic because it throws away information about
the error. We get either a success in the form of a `Some(value)` — or nothing. Let's explore a small elaboration on
`Option`: the `Either` type, which will let us track the reason for an error.

```typescript
type Either<E, A> = Left<E, A> | Right<E, A>;

abstract class EitherBase<E, A> {
  // When mapping over the right side, the left type parameter must be
  // promoted to a supertype to satisfy the covariance imposed by TypeScript
  flatMap<F extends G, G, B>(
      this: Either<F, A>,
      f: (a: A) => Either<G, B>): Either<G, B> { ... }

  map<B>(this: Either<E, A>, f: (a: A) => B): Either<E, B> { ... }

  // Similarly for orElse
  orElse<F extends G, G, T extends U, U>(
      this: Either<F, T>,
      b: () => Either<G, U>): Either<G, U> { ... }
}

class Left<E, A> extends EitherBase<E, A> {
  readonly tag: "left" = "left";

  constructor(readonly value: E) {
    super();
  }
}

class Right<E, A> extends EitherBase<E, A> {
  readonly tag: "right" = "right";

  constructor(readonly value: A) {
    super();
  }
}

const left = <E, A>(val: E): Either<E, A> => new Left(val);

const right = <E, A>(val: A): Either<E, A> => new Right(val);

const map2 = <EE extends E, E, A, B, C>(
    a: Either<E, A>,
    b: Either<EE, B>,
    f: (a: A, b: B) => C): Either<EE, C> => ...
```

Just like `Option`, `Either` has two cases. Unlike `Option`, both cases of `Either` hold a value. By tradition, when
`Either` is used to capture error information, `Left` signifies an error and `Right` a successful result. For this
reason, we've chosen `E` as our left type parameter, to suggest the word "error". However, `Either` is not limited to
representing success or failure, and in fact is broadly useful, for there are many situations in which our computations
can return one of two type.

Because we're choosing to have our `Right` data constructor represent success, we'll want functions like `map` and
`flatMap` to operate only on `Right`, and ignore `Left`. This leaves us with a *right-biased* `Either`.

Here's `mean` again, this time returning a `Left` containing a string represention of the error when the provided list
is empty:

```typescript
const mean = (xs: List<number>): Either<string, number> => {
  const len = length(xs);
  if (len === 0)
    return left("mean of empty list");
  return right(sum(xs) / len);
};
```

### Converting exception-based APIs to `Either`

Just like we did for `Option`, we can wrap an exception-throwing function in an `Either` by returning the thrown
exception as a `Left`. We need to do a little extra work, because in JavaScript, you can throw anything, not just an
`Error`.

```typescript
const Try = <A>(f: () => A): Either<Error, A> => {
  try {
    return right(f());
  } catch (e) {
    if (e instanceof Error)
      return left(e);
    else
      return left(new Error(e));
  }
};

const tryDecodeURI = (s: string) => Try(() => decodeURI(s));
```

### Exercise 4.6. Basic functions on `Either`

Implement versions of `map`, `flatMap`, and `orElse` on `Either` that operate on the right side only. Also implement
`map2` as a top-level function in the `either` module.

??? answer
``` typescript
abstract class EitherBase<E, A> {
  flatMap<F extends G, G, B>(
      this: Either<F, A>,
      f: (a: A) => Either<G, B>): Either<G, B> {
    if (this.tag === "left")
      return left(this.value);
    return f(this.value);
  }

  map<B>(this: Either<E, A>, f: (a: A) => B): Either<E, B> {
    return this.flatMap(a => right(f(a)));
  }

  orElse<F extends G, G, T extends U, U>(
      this: Either<F, T>,
      b: () => Either<G, U>): Either<G, U> {
    if (this.tag === "left")
      return b();
    return this;
  }
}

const map2 = <E, A, B, C>(
    e1: Either<E, A>,
    e2: Either<E, B>,
    f: (a: A, b: B) => C): Either<E, C> =>
  e1.flatMap(a => e2.map(b => f(a, b)));
```
???

### Exercise 4.7. `sequence` and `traverse` for `Either`

Implement `sequence` and `traverse` for `Either`. Both functions should return with the first `Left` they encounter
while processing the input list, or a `Right` containing a list of values if they do not encounter a `Left`.

??? answer
``` typescript
const sequence = <E, A>(le: List<Either<E, A>>): Either<E, List<A>> =>
  traverse(le, ea => ea);

const traverse = <E, A, B>(aa: List<A>,
                           f: (a: A) => Either<E, B>): Either<E, List<B>> =>
  aa.foldRight(right(List()),
               (a, elb) => map2(f(a), elb, (b, lb) => cons(b, lb)));
```
???

Here's an example of using `map2` to conditionally construct a compound object, `Person`. The `mkPerson` function
validates each of its inputs before creating and returning a `Person`.

```typescript
import { Either, left, map2, right } from "../error_handling/either";

class Person {
  constructor(readonly name: Name, readonly age: Age) { }
}

class Name {
  constructor(readonly name: string) { }
}

class Age {
  constructor(readonly age: number)  { }
}

const mkName = (name: string): Either<string, Name> => {
  if (name === "")
    return left("Name is empty.");
  else
    return right(new Name(name));
};

const mkAge = (age: number): Either<string, Age> => {
  if (age < 0)
    return left("Age is out of range.");
  else
    return right(new Age(age));
};

const mkPerson = (name: string, age: number): Either<string, Person> =>
  map2(mkName(name), mkAge(age), (n, a) => new Person(n, a));
```

### Exercise 4.8. Error handling tactics

In the previous example, `mkPerson` is only able to return one error, even if both the name and the age arguments are
invalid. What would we need to change in order to report both errors? Do we need to change the implementation of `map2`,
`mkPerson`, both? Could we create a new data type that's better suited for this requirement than `Either`? How would
`orElse`, `sequence`, and `traverse` need to change to work for this new data type?

??? answer
There are a number of variations on `Option` and `Either`. If we want to accumulate multiple errors, a simple approach
is a new data type that lets us keep a list of errors in the data constructor that represents failures:

``` typescript
type Partial<E, A> = Errors<E, A> | Success<E, A>;

class Errors<E, A> {
  readonly tag: "errors" = "errors";

  constructor(readonly errors: List<E>) { }
}

class Success<E, A> {
  readonly tag: "success" = "success";

  constructor(readonly value: A) { }
}
```

There is a type very similar to this called [`Validation`][fpts_valid] in the fp-ts library. You can implement `map`,
`map2`, `sequence`, and so on for this type in such a way that errors are accumulated when possible (`flatMap` is unable
to accumulate errors &mdash; can you see why?). This idea can even be generalized further &mdash; we don't need to
accumulate failing values into a list; we can accumulate values using any user-supplied binary function.  It's also
possible to use `Either<List<E>, A>` directly to accumulate errors, using different implementations of helper functions
like `map2` and `sequence`.
???

## Summary

You should now be more familiar with the pitfalls associated with using exceptions for error handling, and with two of
the purely functional patterns for error handling: `Option` and `Either`. These data types are common in FP, but the
bigger takeaway is to think about how to represent errors as ordinary values and use higher-order functions to
consolidate error-handling logic.

[js_this]: https://yehudakatz.com/2011/08/11/understanding-javascript-function-invocation-and-this/ "Yehuda Katz - Understanding JavaScript Function Invocation and 'this'"
[ts_fns]: https://www.typescriptlang.org/docs/handbook/functions.html "Functions - TypeScript Handbook"
[ch_3_adt]: chapter_3.html#representing-algebraic-data-types-in-typescript "Chapter 3 - Functional Programming in TypeScript"
[fpis_var]: https://github.com/fpinscala/fpinscala/wiki/Chapter-4:-Handling-errors-without-exceptions#variance-in-optiona "fpinscala Wiki"
[fpts_valid]: https://github.com/gcanti/fp-ts/blob/master/docs/Validation.md "Validation - fp-ts API Documentation"
[wp_single]: https://en.wikipedia.org/wiki/Singleton_pattern "Singleton pattern - Wikipedia"
