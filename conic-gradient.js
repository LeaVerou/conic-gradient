/**
 * CSS conic-gradient() polyfill
 * By Lea Verou — http://lea.verou.me
 * MIT license
 */

(function(){

var π = Math.PI;
var τ = 2 * π;
var ε = .00001;
var deg = π/180;

var dummy = document.createElement("div");
document.head.appendChild(dummy);

var _ = self.ConicGradient = function(o) {
	var me = this;
	_.all.push(this);

	o = o || {};

	this.canvas = document.createElement("canvas");
	this.context = this.canvas.getContext("2d");

	this.repeating = !!o.repeating;

	this.size = o.size || Math.max(innerWidth, innerHeight);

	this.canvas.width = this.canvas.height = this.size;

	var stops = o.stops;

	this.stops = (stops || "").split(/\s*,(?![^(]*\))\s*/); // commas that are not followed by a ) without a ( first

	// If the center position is specified, calculate the center,
	// and remove it from the list of stops
	if(/^at\s[^,]/.test(this.stops[0])) {
		var center_string = this.stops.shift();
		this.center = _.GradientCenter(this, center_string);
	}

	for (var i=0; i<this.stops.length; i++) {
		var stop = this.stops[i] = new _.ColorStop(this, this.stops[i]);

		if (stop.next) {
			this.stops.splice(i+1, 0, stop.next);
			i++;
		}
	}

	// Normalize stops

	// Add dummy first stop or set first stop’s position to 0 if it doesn’t have one
	if (this.stops[0].pos === undefined) {
			this.stops[0].pos = 0;
		}
	else if (this.stops[0].pos > 0) {
		var first = this.stops[0].clone();
		first.pos = 0;
		this.stops.unshift(first);
	}

	// Add dummy last stop or set first stop’s position to 100% if it doesn’t have one
	if (this.stops[this.stops.length - 1].pos === undefined) {
		this.stops[this.stops.length - 1].pos = 1;
	}
	else if (!this.repeating && this.stops[this.stops.length - 1].pos < 1) {
		var last = this.stops[this.stops.length - 1].clone();
		last.pos = 1;
		this.stops.push(last);
	}

	this.stops.forEach(function(stop, i){
		if (stop.pos === undefined) {
			// Evenly space color stops with no position
			for (var j=i+1; this[j]; j++) {
				if (this[j].pos !== undefined) {
					stop.pos = this[i-1].pos + (this[j].pos - this[i-1].pos)/(j-i+1);
					break;
				}
			}
		}
		else if (i > 0) {
			// Normalize color stops whose position is smaller than the position of the stop before them
			stop.pos = Math.max(stop.pos, this[i-1].pos);
		}
	}, this.stops);

	if (this.repeating) {
		// Repeat color stops until >= 1
		var stops = this.stops.slice();
		var lastStop = stops[stops.length-1];
		var difference = lastStop.pos - stops[0].pos;

		for (var i=0; this.stops[this.stops.length-1].pos < 1 && i<10000; i++) {
			for (var j=0; j<stops.length; j++) {
				var s = stops[j].clone();
				s.pos += (i+1)*difference;

				this.stops.push(s);
			}
		}
	}

	this.paint();
};

_.all = [];

_.prototype = {
	toString: function() {
		return "url('" + this.dataURL + "')";
	},

	get dataURL() {
		return "data:image/svg+xml," + this.svg;
	},

	get blobURL() {
		// Warning: Flicker when updating due to slow blob: URL resolution :(
		// TODO cache this and only update it when color stops change
		return URL.createObjectURL(new Blob([this.svg], {type: "image/svg+xml"}));
	},

	get svg() {
		return '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" preserveAspectRatio="none">' +
			'<svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice">' +
			'<image width="100" height="100%" xlink:href="' + this.png + '" /></svg></svg>';
	},

	get png() {
		return this.canvas.toDataURL();
	},

	get r() {
		return Math.sqrt(2) * this.size;
	},

	// Paint the conical gradient on the canvas
	// Algorithm inspired from http://jsdo.it/akm2/yr9B
	paint: function() {
		var c = this.context;

		var radius = this.r;
		// if the gradient center is specified, take the center co-ords from that,
		// otherwise default to 'center center' (50% 50%).
		var x = this.center != null ? this.center.x : this.size / 2;
		var y = this.center != null ? this.center.y : x;

		var stopIndex = 0; // The index of the current color
		var stop = this.stops[stopIndex], prevStop;

		var diff, t;

		for (var i = 0; i < 360; i+=.5) {
			if (i/360 + ε >= stop.pos) {
				// Switch color stop
				do {
					prevStop = stop;

					stopIndex++;
					stop = this.stops[stopIndex];
				} while(stop && stop != prevStop && stop.pos === prevStop.pos);

				if (!stop) {
					break;
				}

				var sameColor = prevStop.color + "" === stop.color + "" && prevStop != stop;

				diff = prevStop.color.map(function(c, i){
					return stop.color[i] - c;
				});
			}

			t = (i/360 - prevStop.pos) / (stop.pos - prevStop.pos);

			var interpolated = sameColor? stop.color : diff.map(function(d,i){
				var ret = d * t + prevStop.color[i];

				return i < 3? ret & 255 : ret;
			});

			// Draw a series of arcs, 1deg each
			c.fillStyle = 'rgba(' + interpolated.join(",") + ')';
			c.beginPath();
			c.moveTo(x, y);

			// In canvas, the 0deg lies on the 90deg of the CSS coordinate system,
			// so transform the angles by that amount.
			var angle = Math.min((360 - 90) * deg, (i - 90) *deg);

			if (sameColor) {
				var θ = 360 * (stop.pos - prevStop.pos);

				i += θ - .5;
			}
			else {
				var θ = .5;
			}

			var endAngle = angle + θ*deg;

			endAngle = Math.min(360*deg, endAngle);

			// 0.02: To prevent moire
			var arc = endAngle - angle;
			c.arc(x, y, radius, arc >= 2*deg? angle : angle - .02, endAngle);

			c.closePath();
			c.fill();

		}
	}
};

_.ColorStop = function(gradient, stop) {
	this.gradient = gradient;

	if (stop) {
		var parts = stop.match(/^(.+?)(?:\s+([\d.]+)(%|deg|turn)?)?(?:\s+([\d.]+)(%|deg|turn)?)?\s*$/);

		this.color = _.ColorStop.colorToRGBA(parts[1]);

		if (parts[2]) {
			var unit = parts[3];

			if (unit == "%" || parts[2] === "0" && !unit) {
				this.pos = parts[2]/100;
			}
			else if (unit == "turn") {
				this.pos  = +parts[2];
			}
			else if (unit == "deg") {
				this.pos  = parts[2] / 360;
			}
		}

		if (parts[4]) {
			this.next = new _.ColorStop(gradient, parts[1] + " " + parts[4] + parts[5]);
		}
	}
}

_.ColorStop.prototype = {
	clone: function() {
		var ret = new _.ColorStop(this.gradient);
		ret.color = this.color;
		ret.pos = this.pos;

		return ret;
	},

	toString: function() {
		return "rgba(" + this.color.join(", ") + ") " + this.pos * 100 + "%";
	}
};

_.ColorStop.colorToRGBA = function(color) {
	if (!Array.isArray(color)) {
		dummy.style.color = color;

		var rgba = getComputedStyle(dummy).color.match(/rgba?\(([\d.]+), ([\d.]+), ([\d.]+)(?:, ([\d.]+))?\)/);

		if (rgba) {
			rgba.shift();
			rgba = rgba.map(function(a) { return +a });
			rgba[3] = isNaN(rgba[3])? 1 : rgba[3];
		}

		return rgba || [0,0,0,0];
	}

	return color;
};

// Get the center of the gradient from a given position string.
//
// * The position string is of this type: at pos1 pos2
// * If pos1 and pos2 are specified as numbers or [number <css_length>] (such as 5px, 30%)
//   then `pos1` is the position along the x-axis, and `pos-2` is along y-axis
// * If pos1 AND pos2 are one of `top|left|right|bottom`, they
//   are also understood, regardless of the order in which they come.
//   Therefore, top left === left top
// * If a parameter is not specified, it is taken as `center`.
//
// So, these are all valid parameters:
// at 20px 80% -> 20px from top, 80% from left
// at center -> 50%, 50%
// at top left -> 0%, 0%
// at right -> 100%, 50%
// at bottom -> 50%, 100%
//
// * Other css length units such as `em` and `rem` are not supported yet.
_.GradientCenter = function(gradient, position) {
	canvas = gradient.canvas;
	var flipped = false
		, temp = null
		, parts = position.match(/^at\s+(.+?)(?:\s+(.+?))?$/);

	if (parts[2] == null) {
		parts[2] = 'center';
	}
	var flipped = /^at\s+(?:top|bottom)(?:\s+)?(?:right|left|center)?$/.test(position);
	if (flipped) {
		temp = parts[1];
		parts[1] = parts[2];
		parts[2] = temp;
	}

	return {
		x: _.GradientCenter.stringToPosition(parts[1], canvas.width),
		y: _.GradientCenter.stringToPosition(parts[2], canvas.height)
	};
};

// Get the position in CSS pixels from a given position string (like 5px, 30%, top, right, center)
// For CSS length values, this works only with `px` and `%` right now.
_.GradientCenter.stringToPosition = function(position, dimension) {
	var parts = position.match(/^(?:(center|top|bottom|right|left|([\d.]+)(%|px)?))$/)
	var pos = 0;
	if (parts[1]) {
		if (parts[1] == 'top' || parts[1] == 'left') {
			pos = 0;
		} else if (parts[1] == 'bottom' || parts[1] == 'right') {
			pos = dimension;
		} else if (parts[1] == 'center') {
			pos = dimension/2;
		} else {
			var unit = parts[3];
			if (unit == 'px' || parts[2] === "0" && !unit) {
				pos = parts[2];
			} else if (unit == '%') {
				pos = parts[2] * dimension / 100;
			}
		}
	}
	return pos;
};

})();

if (self.StyleFix) {
	// Test if conic gradients are supported first:
	(function(){
		var dummy = document.createElement("p");
		dummy.style.backgroundImage = "conic-gradient(white, black)";
		dummy.style.backgroundImage = PrefixFree.prefix + "conic-gradient(white, black)";

		if (!dummy.style.backgroundImage) {
			// Not supported, use polyfill
			StyleFix.register(function(css, raw) {
				if (css.indexOf("conic-gradient") > -1) {
					css = css.replace(/(?:repeating-)?conic-gradient\(\s*((?:\([^()]+\)|[^;()}])+?)\)/g, function(gradient, stops) {
						return new ConicGradient({
							stops: stops,
							repeating: gradient.indexOf("repeating-") > -1
						});
					});
				}

				return css;
			});
		}
	})();
}
