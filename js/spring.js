/*
 * A tiny spring, tuned the way Apple describes it: `response` is roughly
 * how long it takes to get there (seconds) and `damping` is 1 for no
 * overshoot, lower for a little bounce.
 */
(function () {
  'use strict';

  function Spring(value, opts) {
    this.value = value;
    this.target = value;
    this.velocity = 0;
    this.tune(opts);
  }

  Spring.prototype.tune = function ({ response = 0.4, damping = 1 } = {}) {
    this.stiffness = (2 * Math.PI / response) ** 2;
    this.friction = (4 * Math.PI * damping) / response;
  };

  // Advances by dt seconds in small fixed steps so stiff springs stay stable.
  Spring.prototype.step = function (dt) {
    let left = dt;
    while (left > 0) {
      const h = Math.min(left, 1 / 240);
      const force = -this.stiffness * (this.value - this.target) - this.friction * this.velocity;
      this.velocity += force * h;
      this.value += this.velocity * h;
      left -= h;
    }
    if (this.settled()) {
      this.value = this.target;
      this.velocity = 0;
    }
  };

  Spring.prototype.settled = function () {
    return Math.abs(this.value - this.target) < 0.001 && Math.abs(this.velocity) < 0.01;
  };

  // Where a flick would come to rest, using the same decay as scrolling.
  Spring.project = (velocity, rate = 0.998) => (velocity / 1000) * rate / (1 - rate);

  window.Spring = Spring;
})();
