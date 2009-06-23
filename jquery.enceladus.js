/*******************************************************************************
 * Enceladus Version: 0.1 Jason Lawrence (2009) License: GPLv3
 * (http://www.gnu.org/licenses/gpl.txt)
 * 
 * The purpose of Enceladus is primarily to simplify grid-based rendering for
 * the HTML canvas object. The project was inspired primarily by my JSTetris
 * implementation, and was born of a desire to have fast and reusable effects
 * and animations.
 * 
 * 
 * TODO: Support IE (print an obnoxious message)
 * TODO: Conway's Game of Life
 * TODO: Simplily and clean up the interfaces.
 * TODO: Code in an audio equalizer effect.
 * TODO: Add a system for rendering different block types.
 * TODO: Binary display.
 * TODO: Make sure random block drawing can't overload the matrix capacity.
 * TODO: Store animation deltas in a quadtree for speed optimization.
 * 
 ******************************************************************************/
( function($) {

	// A Tango palette to play around with.
	var tango = [
            [ "#fce94f", "#edd400", "#c4a000" ], // Butter
			[ "#8ae234", "#73d216", "#4e9a06" ], // Chameleon
			[ "#e9b96e", "#c17d11", "#8f5902" ], // Chocolate
			[ "#fcaf3e", "#f57900", "#ce5c00" ], // Orange
			[ "#ad7fa8", "#75507b", "#5c3566" ], // Plum
			[ "#ef2929", "#cc0000", "#a40000" ], // Scarlet Red
			[ "#729fcf", "#3465a4", "#204a87" ]  // Sky Blue
	];

	var tango_rgba = [
			[ 'rgba(252,233, 79,', 'rgba(237,212,  0,', 'rgba(196,160,  0,' ],
			[ 'rgba(138,226, 52,', 'rgba(115,210, 22,', 'rgba( 78,154,  6,' ],
			[ 'rgba(233,185,110,', 'rgba(193,125, 17,', 'rgba(143, 89,  2,' ],
			[ 'rgba(252,175, 62,', 'rgba(245,121,  0,', 'rgba(206, 92,  0,' ],
			[ 'rgba(173,127,168,', 'rgba(117, 80,123,', 'rgba( 92, 53,102,' ],
			[ 'rgba(239, 41, 41,', 'rgba(204,  0,  0,', 'rgba(164,  0,  0,' ],
			[ 'rgba(114,159,207,', 'rgba( 52,101,164,', 'rgba( 32, 74,135,' ] ];

	var jlaw_colors = [ [ '#00a8e2' ] // Icy Blue
	];

	/**
	 * Helper: Hex color to RGB array.
	 */
	hexToRGB = function(hex) {
		return [ parseInt(hex.substring(1, 3), 16),
				parseInt(hex.substring(3, 5), 16),
				parseInt(hex.substring(5, 7), 16) ];
	};

	/**
	 * Helper: Assemble RGB color from array to hex.
	 */
	rgbArrayToHex = function(rgb) {
		return '#' + rgb[0].toString(16) + rgb[1].toString(16)
				+ rgb[2].toString(16);
	};

	/**
	 * Build a color fade chain element. Takes hex or rgb color, and an
	 * increment counter. TODO: Make the omission of one color cause it to be
	 * the default. TODO: Detect bad values.
	 */
	colorFadeEffect = function(start_color, end_color, increment, next) {

		sc = [ -1, -1, -1 ];
		ec = [ -1, -1, -1 ];

		if (start_color[0] == '#') {
			sc = hexToRGB(start_color);
		} else {
			alert('implement');
		}

		if (end_color[0] == '#') {
			ec = hexToRGB(end_color);
		} else {
			alert('implement');
		}

		deltas = [ sc[0] - ec[0], sc[1] - ec[1], sc[2] - ec[2] ].map( function(
				x) {
			if (Math.abs(x) < increment) {
				return 1;
			} else {
				return -1 * Math.round(x / (increment));
			}
		});

		return [ 2, sc, deltas, increment, next ];

	};

	/**
	 * Build a shadow fade effect. We'll cheat here and just use the
	 * colorFadeEffect and change the type from 2->3.
	 */
	shadowColorFadeEffect = function(start_color, end_color, increment, next) {

		cf = colorFadeEffect(start_color, end_color, increment, next);

		cf[0] = 3;

		return cf;

	};

	/**
	 * Scale effect. Resizes a block. For now, this will only resize blocks
	 * safely if they don't overlap other blocks.
	 */
	scaleEffect = function(xs, ys, xe, ye, inc, next) {

		xd = (xe - xs) / inc;
		yd = (ye - ys) / inc;

		return [ 4, [ xs, ys ], [ xd, yd ], inc, next ];

	};

	/**
	 * Blur effect. Changes the blur dimensions on a block. [1, start_blur,
	 * blur_step, step, [1, end_blur, -1*blur_step, step, -1]]
	 */
	blurEffect = function(bs, be, inc, next) {

		bd = (be - bs) / inc;

		return [ 1, bs, bd, inc, next ];

	};

	/**
	 * Opacity effect. Changes a block's opacity.
	 */
	opEffect = function(os, oe, inc, next) {

		od = (oe - os) / inc;

		return [ 0, os, od, inc, next ];

	};

	/**
	 * Array deep copy. Needed to properly maintain effect chain integrity.
	 * Method borrowed from:
	 * http://james.padolsey.com/javascript/deep-copying-of-objects-and-arrays/
	 */
	copyEffect = function(obj) {
		if (Object.prototype.toString.call(obj) === '[object Array]') {
			var out = [], i = 0, len = obj.length;
			for (; i < len; i++) {
				out[i] = arguments.callee(obj[i]);
			}
			return out;
		}
		if (typeof obj === 'object') {
			var out = {}, i;
			for (i in obj) {
				out[i] = arguments.callee(obj[i]);
			}
			return out;
		}
		return obj;
	};

	/**
	 * Randomly toggle matrix pixels with a specified animation chain. Pixels
	 * are toggled off on method completion.
	 */
	randomBlock = function(ctx, blocks, animation) {

		// Draw random blocks
		for (x = 0; x < blocks; x++) {
			used_val = true;

			// Make sure we aren't maxing the grid. (max 5 guesses).
			safety_counter = 5;

			do {
				px = Math.floor(Math.random() * ctx.dimensions[0]);
				py = Math.floor(Math.random() * ctx.dimensions[1]);

				if (ctx.matrix[px][py][0] == 0) {
					used_val = false;
					ctx.matrix[px][py][0] = 1;

					// Set the animation.
					ctx.matrix[px][py][1] = copyEffect(animation);
				} else {
					safety_counter--;
				}

			} while (used_val && safety_counter > 0)

		}

	};

	// Initiate the effects callback function.
	effects = function() {

		ctx = this;

		w = ctx.block_dimensions[0];
		h = ctx.block_dimensions[1];

		for (x = 0; x < ctx.dimensions[0]; x++) {
			for (y = 0; y < ctx.dimensions[1]; y++) {
				if (ctx.matrix[x][y][1].length > 0) {

					// Clear/Draw?
					draw_flag = false;

					// Save context
					ctx.save();

					// Translate origin to block center.
					ctx.translate((x * w) + (w / 2), (y * h) + (h / 2));

					// Iterate through the animation array.
					for (i = 0; i < ctx.matrix[x][y][1].length; i++) {
						mt = ctx.matrix[x][y][1][i];

						// Decrease the mutator value.
						mt[3]--;

						// TODO: Redesign the animation chaining system.
						if (mt[3] < 0) {
							//draw_flag = false;
							if (mt[4] == -1) {
								ctx.matrix[x][y][1].splice(i, 1);
							} else if (mt[4] == -2) {
								// TODO: Get rid of this case!
								ctx.matrix[x][y][0] = 0;
								ctx.matrix[x][y][1].splice(i, 1);
							} else if (mt[4] != -1) {
								ctx.matrix[x][y][1].splice(i, 1, mt[4]);
							}

						} else {
							// Draw flag on.
							draw_flag = true;

							// TODO: Add an endchain op for running a function
							// (case-1)
							switch (mt[0]) {
							case 0:
								mt[1] += mt[2];
								ctx.globalAlpha = mt[1];
								break;
							case 1:
								mt[1] += mt[2];
								ctx.shadowBlur = mt[1];
								break;
							case 2:
								mt[1][0] += mt[2][0];
								mt[1][1] += mt[2][1];
								mt[1][2] += mt[2][2];
								ctx.fillStyle = rgbArrayToHex(mt[1]);
								break;
							case 3:
								mt[1][0] += mt[2][0];
								mt[1][1] += mt[2][1];
								mt[1][2] += mt[2][2];
								ctx.shadowColor = rgbArrayToHex(mt[1]);
								break;
							case 4:
								mt[1][0] += mt[2][0];
								mt[1][1] += mt[2][1];
								ctx.scale(mt[1][0], mt[1][1]);
								break;
							}
							;

						}

					}

					if (draw_flag) {

						ctx.clearRect(-1 * (w / 2), h / 2, w, -1 * h);
						drawRoundedBlock(ctx, x, y);

					}

					// Restore the context.
					ctx.restore();

				}

			}

		}

	};

	/**
	 * Start the effects loop.
	 */
	$.fn.effectsLoop = function() {
		if ($.browser.msie)
			return;
		return this.each( function() {

			// Initial checks...
				if (this.context == null) {
					return;
				}
				var context = this.context;

				// Return if an effects loop is already running on this context.
				if (context.effects_interval != null) {
					return;
				}

				// Initiate
				context.effects = context.effects || effects;
				context.effects_interval = setInterval( function() {
					context.effects();
				}, 32);

			});

	};

	/**
	 * Rendering Helper: Clip a rounded block area.
	 */
	clipRoundedBlock = function(ctx, x, y) {

		// shorthand for the radix coeffs
		hc1 = ctx.hcoeff_1 * 2;
		vc1 = ctx.vcoeff_1 * 2;

		x = ctx.block_dimensions[0] / 2;// - ctx.max_shadow;
		y = ctx.block_dimensions[1] / 2;// - ctx.max_shadow;

		xh1 = -1 * x * hc1;
		xh2 = x * hc1;
		yh1 = -1 * y * vc1;
		yh2 = y * vc1;

		ctx.beginPath();

		ctx.moveTo(xh2, y);
		ctx.lineTo(xh2, y);
		ctx.quadraticCurveTo(x, y, x, yh2);
		ctx.lineTo(x, yh1);
		ctx.quadraticCurveTo(x, -1 * y, xh2, -1 * y);
		ctx.lineTo(xh1, -1 * y);
		ctx.quadraticCurveTo(-1 * x, -1 * y, -1 * x, yh1);
		ctx.lineTo(-1 * x, yh2);
		ctx.quadraticCurveTo(-1 * x, y, xh1, y);

		ctx.closePath();

		ctx.clip();

	};

	/**
	 * Rendering Helper: Draw a rounded block.
	 * 
	 */
	drawRoundedBlock = function(ctx, x, y) {

		// shorthand for the radix coeffs
		hc1 = ctx.hcoeff_1 * 2;
		vc1 = ctx.vcoeff_1 * 2;

		x = ctx.block_dimensions[0] / 2 - ctx.max_shadow;
		y = ctx.block_dimensions[1] / 2 - ctx.max_shadow;

		xh1 = -1 * x * hc1;
		xh2 = x * hc1;
		yh1 = -1 * y * vc1;
		yh2 = y * vc1;

		ctx.beginPath();

		ctx.moveTo(xh2, y);
		ctx.quadraticCurveTo(x, y, x, yh2);
		ctx.lineTo(x, yh1);
		ctx.quadraticCurveTo(x, -1 * y, xh2, -1 * y);
		ctx.lineTo(xh1, -1 * y);
		ctx.quadraticCurveTo(-1 * x, -1 * y, -1 * x, yh1);
		ctx.lineTo(-1 * x, yh2);
		ctx.quadraticCurveTo(-1 * x, y, xh1, y);

		ctx.closePath();

		ctx.fill();

	};

	/**
	 * Initialize colors / shadows. TODO: Configurability.
	 */
	$.fn.blockStyle = function() {
		if ($.browser.msie)
			return;
		return this.each( function() {

			// Defaulting to tango blue
				this.defaultStyle = tango[6][0];
				this.fillStyle = this.defaultStyle;

				// TODO: Calculate the shadow size and color.
				this.max_shadow = 6;

				this.defaultShadowBlur = this.max_shadow / 2;
				this.shadowBlur = this.defaultShadowBlur;
				this.defaultShadow = jlaw_colors[0];
				this.shadowColor = this.defaultShadow;

			});

	};

	/**
	 * Initialize block size.
	 */
	$.fn.blockSize = function(x, y) {

		if ($.browser.msie)
			return;
		return this.each( function() {

			// TODO: Auto calculation for a default block setting.

				// Set the height and width.
				this.dimensions = [ x, y ];
				this.block_dimensions = [ this.width / x, this.height / y ];

			});

	};

	/**
	 * Initialize block shape.
	 */
	$.fn.blockShape = function(radix) {

		if ($.browser.msie)
			return;
		return this.each( function() {

			//var radix = block_radix;
				radix = radix || 15;

				// Make sure the radix given is compatible with the actual block
				// dimensions.
				if (radix > this.block_dimensions[0] / 2) {
					radix = this.block_dimensions[0] / 2;
				}
				if (radix > this.block_dimensions[1] / 2) {
					radix = this.block_dimensions[1] / 2;
				}

				this.hcoeff_1 = radix / this.block_dimensions[0];
				this.vcoeff_1 = radix / this.block_dimensions[1];

			});

	};

	/**
	 * Initialize the rendering context.
	 */
	$.fn.initContext = function() {
		if ($.browser.msie)
			return;
		return this.each( function() {

			this.context = this.getContext('2d');

			// Set some useful attributes on the context.
				this.context.height = this.height;
				this.context.width = this.width;
			});
	};

	/**
	 * Initialize a rendering matrix.
	 */
	$.fn.buildMatrix = function(x, y) {
		if ($.browser.msie)
			return;
		return this.each( function() {

			// Build the context matrix.
				this.matrix = new Array(x);
				for (i = 0; i < x; i++) {
					this.matrix[i] = new Array(y);
					for (r = 0; r < y; r++) {
						// TODO: These attributes.
						// 0: type, 1: effects array, 2: current color, 3:
						// current shadow color
						// 4: current opacity, 5: current shadow blur.
						this.matrix[i][r] = [ 0, [] ];
					}
				}

			});

	};

	/**
	 * Render a cool ghostly block effect on the selected canvas.
	 */
	$.fn.ghostBlocks = function(block_num, duration, speed) {
		if ($.browser.msie)
			return;
		return this.each( function() {

			if (this.context == null) {
				return;
			}
			var context = this.context;

			speed = speed || 1000;

			$(this).effectsLoop();

			// Ghost animation.
				opacity = 0.8;

				step = 10;
				end_blur = context.max_shadow - 1;
				start_blur = context.defaultShadowBlur;

				// Template animations.
				opFade = opEffect(0.0, opacity, step, opEffect(opacity, 0.0,
						step, -2));
				blurFade = blurEffect(start_blur, end_blur, step, blurEffect(
						end_blur, start_blur, step, -2));
				scaleFade = scaleEffect(0.5, 0.5, 1.0, 1.0, step, scaleEffect(
						1.0, 1.0, 0.5, 0.5, step, -2));

				var ghostFade = [ opFade, blurFade, scaleFade ];

				// Draw random blocks at the specified interval.
				context.random_interval = setInterval( function() {
					randomBlock(context, block_num, ghostFade);
				}, speed);

				if (duration != null) {
					setTimeout(
							'clearInterval(' + context.random_interval + ')',
							duration);
				}

			});
	};

	/**
	 * Initialize a rendering grid.
	 */
	$.fn.gridSetup = function(x, y, block_radix) {
		if ($.browser.msie)
			return;
		return this.each( function() {

			// Initialize the context for this canvas.
				$(this).initContext();

				// Initialize block size,shape,colors,shadows.
				$(this.context).blockSize(x, y);
				$(this.context).blockShape(block_radix);
				$(this.context).blockStyle();

				// Build the context grid.
				$(this.context).buildMatrix(x, y);

			});
	};

	/**
	 * Makes a tile glow when moused over. Optionally, provide an overlay
	 * element (the element that actually receives the mouse gestures)
	 */
	$.fn.glowTouch = function(canvas_elem, color2, color1) {
		if ($.browser.msie)
			return;
		return this.each( function() {

			if (this.context == null) {
				return;
			}
			var ctx = this.context;

			color1 = color1 || tango[6][0];
			color2 = color2 || tango[1][0];

			// Ensure that the effects loop is initialized (idempotent).
				$(this).effectsLoop();

				// If no canvas element is specified, assume that this canvas
				// will receive mouse events.
				canvas_elem = canvas_elem || this;

				// One-way fade out animations.
				opFadeOut = opEffect(1.0, 0.0, 10, -1);
				blurFadeOut = blurEffect(10, 0.0, 10, -1);
				colorFadeOut = colorFadeEffect(color2, color1, 10, -1);
				shadowFadeOut = shadowColorFadeEffect(color2, color1, 10, -1);

				var fadeOutSet = [ opFadeOut, blurFadeOut, colorFadeOut,
						shadowFadeOut ];

				// One-way fade in animations.
				opFadeIn = opEffect(0.0, 1.0, 10, -1);
				blurFadeIn = blurEffect(0, 10, 10, -1);
				colorFadeIn = colorFadeEffect(color1, color2, 10, -1);
				shadowFadeIn = shadowColorFadeEffect(color1, color2, 10, -1);

				var fadeInSet = [ opFadeIn, blurFadeIn, colorFadeIn,
						shadowFadeIn ];

				// Handle mouseout events correctly by fading the last piece
				// touched.
				$(canvas_elem)
						.mouseout(
								function() {

									if (ctx.current_piece != null
											&& ctx.current_piece[0] != -1
											&& ctx.current_piece[1] != -1) {

										ctx.matrix[ctx.current_piece[0]][ctx.current_piece[1]][1] = copyEffect(fadeOutSet);
										ctx.current_piece = [ -1, -1 ];
									}

								});

				// Fade in the piece the mouse is on, and fade out the last
				// piece it was on if necessary.
				$(canvas_elem)
						.mousemove( function(e) {

							// Determine mouse position
								px = e.pageX - this.offsetLeft;
								py = e.pageY - this.offsetTop;

								// Retrieve canvas context
								// Map mouse to grid box
								grid_x = Math.floor((px)
										/ (ctx.block_dimensions[0]));
								grid_y = Math.floor((py)
										/ (ctx.block_dimensions[1]));

								if (ctx.current_piece == null) {
									ctx.current_piece = [ -1, -1 ];
								} else if ((ctx.current_piece[0] == grid_x)
										&& (ctx.current_piece[1] == grid_y)) {
									return;
								} else {

									// Do a fade out on the last piece.
									if ((ctx.current_piece[0] >= 0)
											&& (ctx.current_piece[1] >= 0)) {
										ctx.matrix[ctx.current_piece[0]][ctx.current_piece[1]][1] = copyEffect(fadeOutSet);
									}

									// Set this piece as the current piece.
									ctx.current_piece[0] = grid_x;
									ctx.current_piece[1] = grid_y;

									ctx.matrix[grid_x][grid_y][1] = copyEffect(fadeInSet);

								}

							});

			});
	};

	/**
	 * Draw the Hacker Emblem.
	 * 
	 */
	$.fn.drawGlider = function() {
		if ($.browser.msie)
			return;
		return this.each( function() {
			if (this.context == null) {
				return;
			}
			var ctx = this.context;

			$(this).effectsLoop();

			// Find the top left point of the area we will center the Glider on.
				tl = [ Math.floor((ctx.dimensions[0] / 2) - 1),
						Math.floor((ctx.dimensions[1] / 2) - 1) ];

				// Draw points. (we can copy the effect here with slice(), as
				// the array is flat.)
				var fadeIn = opEffect(0.0, 1.0, 10, -1);
				ctx.matrix[tl[0] + 1][tl[1]][1].push(fadeIn.slice());
				ctx.matrix[tl[0] + 2][tl[1] + 1][1].push(fadeIn.slice());
				ctx.matrix[tl[0]][tl[1] + 2][1].push(fadeIn.slice());
				ctx.matrix[tl[0] + 1][tl[1] + 2][1].push(fadeIn.slice());
				ctx.matrix[tl[0] + 2][tl[1] + 2][1].push(fadeIn.slice());

				ctx.matrix[tl[0] + 1][tl[1]][0] = 1;
				ctx.matrix[tl[0] + 2][tl[1] + 1][0] = 1;
				ctx.matrix[tl[0]][tl[1] + 2][0] = 1;
				ctx.matrix[tl[0] + 1][tl[1] + 2][0] = 1;
				ctx.matrix[tl[0] + 2][tl[1] + 2][0] = 1;

				// Animations (copied with copyEffect)
				step = 10;
				end_blur = ctx.max_shadow;
				start_blur = ctx.defaultShadowBlur;

				var animSet = [
						colorFadeEffect(tango[6][0], tango[1][0], step,
								colorFadeEffect(tango[1][0], tango[6][0], step,
										-1)),
						blurEffect(start_blur, end_blur, step, blurEffect(
								end_blur, start_blur, step, -1)),
						shadowColorFadeEffect(tango[6][0], tango[1][0], step,
								shadowColorFadeEffect(tango[1][0], tango[6][0],
										step, -1)),
						scaleEffect(1, 1, 0.75, 0.75, 10, scaleEffect(0.75,
								0.75, 1.0, 1.0, 10, -1)) ];

				var animSet2 = [
						opEffect(0.0, 0.6, 10, opEffect(0.6, 0.0, 10, -1)),
						scaleEffect(0.25, 0.25, 0.5, 0.5, 10, scaleEffect(0.5,
								0.5, 0.25, 0.25, 10, -1)) ];

				setInterval( function() {
					used_val = true;
					px = -1;
					py = -1;

					do {
						px = Math.floor(Math.random() * ctx.dimensions[0]);
						py = Math.floor(Math.random() * ctx.dimensions[1]);

						if (ctx.matrix[px][py][0] == 1) {
							used_val = false;
						} else {
							//ctx.matrix[px][py][1] = copyEffect(animSet2);
					}

				} while (used_val)

				ctx.matrix[px][py][1] = copyEffect(animSet);

			}, 2000);

			});

	};

	/**
	 * Conway's Game of Life Mode (FTW!).
	 * 
	 */
	$.fn.conwayMode = function() {

		// TODO

	};

})(jQuery);
