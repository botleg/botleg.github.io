---
summary: Use generators in JavaScript and Python to generate Fibonacci numbers
title: Generators in JavaScript and Python
layout: post
categories: javascript
bg: "background:#6441A5;background:-webkit-linear-gradient(90deg, #6441A5 10%, #2a0845 90%);background:-moz-linear-gradient(90deg, #6441A5 10%, #2a0845 90%);background:-ms-linear-gradient(90deg, #6441A5 10%, #2a0845 90%);background:-o-linear-gradient(90deg, #6441A5 10%, #2a0845 90%);background:linear-gradient(90deg, #6441A5 10%, #2a0845 90%);"
date:   2015-10-04 23:00:00
tags: python generator iterator es6 es2015 fibonacci yield
---
With the introduction of JavaScript ES6 or ES2015, we got a whole lot of new features for the language. Among those, `generator` sure is an interesting one. Generator is basically a function which can be paused and resumed as we need it. The state of the generator stays constant while it's paused. You can read more about this [here](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Iterators_and_Generators#Generators). In this article, we are going to compare generators in JavaScript to the ones in a language that has been supporting it for a long time now, Python.

We will see how to create an `iterator` with generator function. Iterator contains a set of values in a sequence. We can go through the elements in an iterator with a `for` loop. For this example, we will create an iterator for `Fibonacci Numbers`.

Generator
---------
Generator is just another function. The only difference is that it can be paused and resumed. While the normal functions use `return` to give back a value and stop its execution, a generator function uses `yield` to give a value back and pause the function. We can resume the function with the `next()` command and the function will give back the value in the next yield. We can also go through the values in a generator with a loop. The generator functions can also have a `return` statement which can be used to terminate its execution.

JavaScript
----------
In JavaScript, a generator definition contains an `*`. It could also have a yield statement.
{% highlight javascript %}
function* getFibonacci() {
  //yield something;
}
{% endhighlight %}

In the [Fibonacci series](https://en.wikipedia.org/wiki/Fibonacci_number), the first two numbers are 0 and 1 and the rest is the sum of previous two values. So, it goes like `0, 1, 1, 2, 3, 5, 8, 13, 21, ...`. The code for getting Fibonacci Numbers less than 100 is this.
{% highlight javascript %}
function* getFibonacci() {
  yield a = 0;
  b = 1;
  
  while (true) {
    yield b;
    b = a + b;
    a = b - a;
  }
}

for (num of getFibonacci()) {
  if (num > 100) {
    break;
  }
  console.log(num);
}
{% endhighlight %}

Note that ES6 is required for running this code. We first define the generator function `getFibonacci()` with the `*`. The first value in the sequence is `0`, so we have to return that with an yield. We can use an expression with yield statement and the result of the expression is send out with yield. Now we store the previous two values in `a` and `b`. The starting values of `a` and `b` are `0` and `1` respectively, the first two values in the sequence. We can assign value to `a` and yield it in a single statement.

We start an infinite `while` loop. We now yield the value in `b`, which is now the second number in the sequence. Now we set `b` to the sum of `a` and `b` and set `a` as the previous value of `b`. This can be done simply by,
{% highlight javascript %}
b = a + b;
a = b - a;
{% endhighlight %}
Now, `b` will contain the third number in the sequence, which is then given out with yield. This goes on and on with `b` always having the next number in the sequence.

This generator acts as an iterator factory for Fibonacci Numbers. We can loop through this iterator with the `for .. of` loop. As this gives all the Fibonacci Numbers till infinity, we need a `break` condition. Here, we take the Fibonacci Numbers less than 100 and logs it.
{% highlight javascript %}
for (num of getFibonacci()) {
  if (num > 100) {
    break;
  }
  console.log(num);
}
{% endhighlight %}

Python
------
The python implementation of this same problem is very similar. The code for the solution is this.
{% highlight python %}
def getFibonacci():
  yield 0
  a, b = 0, 1

  while True:
    yield b
    b = a + b
    a = b - a

for num in getFibonacci():
  if num > 100:
    break
  print(num)
{% endhighlight %}

We start with the `getFibonacci()` generator function. In python, there is no difference between generators and normal function definition. The only difference is in the appearence of the `yield` keyword. We can't use expressions with yield in Python, as we have done in JavaScript. So, we will yield the first number in the sequence `0` and then assign the initial values to `a` and `b`.

As before, we than have an infinite loop which yields the next value in the sequence and calculates new values of `a` and `b`. This is same as in JavaScript.

To loop through the numbers in the `getFibonacci()` iterator, we can use `for .. in` loop. The rest is same as in the case of JavaScript.

Conclusion
----------
Except for some subtle differences, the implementation of generators in JavaScript and Python are really similar. With ES6, we can program in JavaScript as we do it in Java, C, or Python.