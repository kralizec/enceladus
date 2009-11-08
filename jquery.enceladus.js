/*******************************************************************************
 * Enceladus Version: 0.1 Jason Lawrence (2009)
 * License: GPLv3 (http://www.gnu.org/licenses/gpl.txt)
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
 * TODO: Make sure random block drawing can't overload the matrix capacity.
 * TODO: Store animation deltas in a quadtree for speed optimization.
 * TODO: Support animation merging properly.
 * TODO: Support block shape changing animations.
 * TODO: Support multiple-color block color transitions.
 * TODO: Support repeating animation chains that can halt on a condition.
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
		[ 'rgba(252,233, 79,', 'rgba(237,212,  0,', 'rgba(196,160,  0,' ], // Butter
		[ 'rgba(138,226, 52,', 'rgba(115,210, 22,', 'rgba( 78,154,  6,' ], // Chameleon
		[ 'rgba(233,185,110,', 'rgba(193,125, 17,', 'rgba(143, 89,  2,' ], // Chocolate
		[ 'rgba(252,175, 62,', 'rgba(245,121,  0,', 'rgba(206, 92,  0,' ], // Orange
		[ 'rgba(173,127,168,', 'rgba(117, 80,123,', 'rgba( 92, 53,102,' ], // Plum
		[ 'rgba(239, 41, 41,', 'rgba(204,  0,  0,', 'rgba(164,  0,  0,' ], // Scarlet Red
		[ 'rgba(114,159,207,', 'rgba( 52,101,164,', 'rgba( 32, 74,135,' ]  // Sky Blue
	];

	var jlaw_colors = [
		[ '#00a8e2' ] // Icy Blue
	];


	// The palette object. Defaults to Tango.
	var palette = [
		[ "#fce94f", "#edd400", "#c4a000" ], // Butter
		[ "#8ae234", "#73d216", "#4e9a06" ], // Chameleon
		[ "#e9b96e", "#c17d11", "#8f5902" ], // Chocolate
		[ "#fcaf3e", "#f57900", "#ce5c00" ], // Orange
		[ "#ad7fa8", "#75507b", "#5c3566" ], // Plum
		[ "#ef2929", "#cc0000", "#a40000" ], // Scarlet Red
		[ "#729fcf", "#3465a4", "#204a87" ]  // Sky Blue
	];


	/************************
	 * Defaults
	 ************************/


	/**
	 * Helper: Hex color to RGB array.
	 */
        hexToRGB = function(hex) {
            return [
                parseInt(hex.substring(1, 3), 16),
                parseInt(hex.substring(3, 5), 16),
                parseInt(hex.substring(5, 7), 16)
            ];
        };

	/**
	 * Helper: Assemble RGB color from array to hex.
	 */
        rgbArrayToHex = function(rgb) {
            return '#' + rgb[0].toString(16)
                       + rgb[1].toString(16)
                       + rgb[2].toString(16);
        };

	/**
	 * Helper: Assemble RGB color to hex.
	 */
        rgbToHex = function(r, g, b) {
            return '#' + r.toString(16)
                       + g.toString(16)
                       + b.toString(16);
        };

	/**
	 * Build a color fade chain element. Takes hex or rgb color, and an
	 * increment counter. TODO: Make the omission of one color cause it to be
	 * the default. TODO: Detect bad values.
         * FIXME: Get rid of stupid arrays.
	 */
        colorFadeEffect = function(start_color, end_color, increment, next) {

            var sc = [ -1, -1, -1 ];
            var ec = [ -1, -1, -1 ];

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

            var deltas = [ sc[0] - ec[0], sc[1] - ec[1], sc[2] - ec[2] ].map( function(x) {
                if (Math.abs(x) < increment) {
                    return 1;
                } else {
                    return -1 * Math.round(x / (increment));
                }
            });

            return [ 2, increment, next, sc[0], sc[1], sc[2], deltas[0], deltas[1], deltas[2] ];

        };

	/**
	 * Build a shadow fade effect. We'll cheat here and just use the
	 * colorFadeEffect and change the type from 2->3.
	 */
        shadowColorFadeEffect = function(start_color, end_color, increment, next) {
            var cf = colorFadeEffect(start_color, end_color, increment, next);
            cf[0] = 3;
            return cf;
        };

        /**
         * Scale effect. Resizes a block. For now, this will only resize blocks
         * safely if they don't overlap other blocks.
         */
        scaleEffect = function(xs, ys, xe, ye, inc, next) {
            var xd = (xe - xs) / inc;
            var yd = (ye - ys) / inc;
            return [ 4, inc, next, xs, ys, xd, yd ];
        };

        /**
         * Blur effect. Changes the blur dimensions on a block. [1, start_blur,
         * blur_step, step, [1, end_blur, -1*blur_step, step, -1]]
         */
        blurEffect = function(bs, be, inc, next) {
            var bd = (be - bs) / inc;
            return [ 1, inc, next, bs, bd ];
        };

        /**
         * Opacity effect. Changes a block's opacity.
         */
        opEffect = function(os, oe, inc, next) {
            var od = (oe - os) / inc;
            return [ 0, inc, next, os, od ];
        };

        /**
         * Trigger a draw effect. Draws a pixel with a specified color.
         */
        drawEffect = function(next){
            return [ -1, 1, next ];
        };

        /**
         * Clear effect. Clears the pixel.
         */
        clearEffect = function(next){
            return [ -2, 1, next ];
        };

        /**
         * End chain effect. Determines what to do after the animation.
         * 
         */
        endChain = function(command){
            return [-3, 1, null, command];
        };

        /**
         * Delayed command.
         */
        delayExec = function(ctx, delay, command){
            ctx.cmd_stack.push([0, delay, command]);
        }

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
            var x, px, py, used_val, safety_counter; 

            // Draw random blocks
            for (x = 0; x < blocks; x++) {
                used_val = true;

                // Make sure we aren't maxing the grid. (max 5 guesses).
                safety_counter = 5;

                do {
                    px = Math.floor(Math.random() * ctx.dimensions[0]);
                    py = Math.floor(Math.random() * ctx.dimensions[1]);

                    if (ctx.getState(px, py) == 0) {
                        used_val = false;
                        ctx.setState(px, py, 1);

                        // Set the animation.
                        ctx.setAnim(px, py, copyEffect(animation));
                    } else {
                        safety_counter--;
                    }

                } while (used_val && safety_counter > 0)

            }

        };

	// Initiate the effects callback function.
	effects = function() {

            var x,y,i,cmd;

		var ctx = this;

		var w = ctx.block_dimensions[0];
		var h = ctx.block_dimensions[1];

        // TODO: Store animation deltas more sanely.
        // Execute grid allocated animations.
	
	// Reset the frame:
	ctx.frame = [];

	//for(i = 0; i < (h * w + w); i++){	
	for (x = 0; x < ctx.dimensions[0]; x++) {
		for (y = 0; y < ctx.dimensions[1]; y++) {

			i = y * ctx.dimensions[0] + x;
		
			if(ctx.agrid[i].length > 0){
				//ctx. null,renderFrame(i,x,y,w,h);
				ctx.buildFrame(i,x,y);
			} 
		}
	}

	// Do the render
	ctx.renderFrame(w,h);

        // Execute delayed commands.
        for (x = 0; x < ctx.cmd_stack.length; x++){
            cmd = ctx.cmd_stack[x];            
            switch(cmd[0]){
                case 0: // Simple delayed command
                    //if(cmd[1] == 0){ eval(cmd[2]); }
		    if(cmd[1] == 0){ cmd[2](); }
                    break;
            }

            cmd[1]--;
            if(cmd[1] < 0){
                ctx.cmd_stack.splice(x,1);
            }

        }

	};

	/**
	 * Set up the effects.
	 */
	$.fn.effectsSetup = function(){
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

			// Register the effects methods
                        // FIXME: Make effect registration automatic.
			context.shadowColorFadeEffect = shadowColorFadeEffect;
			context.blurEffect = blurEffect;
			context.opEffect = opEffect;
			context.clearEffect = clearEffect;
			context.drawEffect = drawEffect;
			context.scaleEffect = scaleEffect;
			context.endChain = endChain;
			context.copyEffect = copyEffect;

			// Initiate
			context.effects = context.effects || effects;

			// TODO: TEMP ONLY
			context.frame = [];
		
			// Build the frame
			context.buildFrame = function(aind,x,y){

				// Clean the mutators.
				//muts = this.agrid[aind]
				////new_muts = [];
				//for(i = 0; i < muts.length; i++){
				//	if(muts[i][0] == -3 && muts[i][4] == -1){	
				//		//new_muts.push(muts[i]);
				//		muts.splice(i,1);
				//	}
				//}
				//muts = new_muts;
				//context.frame.push([x,y,muts]);
				context.frame.push([x,y,this.agrid[aind]]);

			};

			// Create rendering func
			//context.renderFrame = function(aind,x,y,w,h){
			context.renderFrame = function(w,h){
                            var  z, x, y, draw_flag, muts, mt;

				for( z = 0; z < this.frame.length; z++){
                                    // TODO: Set a bunch of current params for the current render block.
					x = this.frame[z][0];
					y = this.frame[z][1];
                                        this.x = x;
                                        this.y = y;
					muts = this.frame[z][2];

					// Clear/Draw?
					draw_flag = true;

					// Save context
					this.save();

					// Translate origin to block center.
					this.translate((x * w) + (w / 2), (y * h) + (h / 2));

					// Iterate through the animation array.
					//for (i = 0; i < this.agrid[aind].length; i++) {
					//	mt = this.agrid[aind][i];
					for (i = 0; i < muts.length; i++){
						mt = muts[i];

						// Mutator structure:
						// [  0  ,    1     ,  2  ,  3  ,     ]
						// [ type, mut_count, next, data, ... ]

						// TODO: Add an endchain op for running a function after a given interval.
						// (case-1)
						switch (mt[0]) {
						case -3:
							draw_flag = false;
							// TODO: Don't use eval here. Pass a closure.
							//if(mt[1] != null){ eval(mt[1]); }
							if(mt[3] != null){ mt[3](); }
							//mt[0] = -4;
							break;
						case -2:
							this.clearRect(-1 * (w / 2), h / 2, w, -1 * h);
							draw_flag = false;
							break;
						case -1:
							break;
						case 0:
							mt[3] += mt[4];
							this.globalAlpha = mt[3];
							break;
						case 1:
							mt[3] += mt[4];
							this.shadowBlur = mt[3];
							break;
						case 2: // TODO: Color fades for multi-color draws.
							mt[3] += mt[6];
							mt[4] += mt[7];
							mt[5] += mt[8];
							//this.fillStyle = rgbArrayToHex(mt[3]);
							this.fillStyle = rgbToHex(mt[3],mt[4],mt[5]);
							break;
						case 3: // TODO: Color fades for multi-color draws.
							mt[3] += mt[6];
							mt[4] += mt[7];
							mt[5] += mt[8];
							//this.shadowColor = rgbArrayToHex(mt[3]);
							this.shadowColor = rgbToHex(mt[3],mt[4],mt[5]);
							break;
						case 4:
							mt[3] += mt[5];
							mt[4] += mt[6];
							this.scale(mt[3], mt[4]);
							break;
						}

						// Decrease the mutator.
						mt[1]--;

						// Replace the endchain if the mutator is below 0.
						if(mt[1] < 0){
							draw_flag = false;
							//ctx.matrix[x][y][1].splice(i, 1, mt[4]);

							// TODO: Redo animation chaining. Make it flat.
							// That should make for less overhead, and fewer errors.
							//this.agrid[aind].splice(i,1, mt[2]);
							if(mt[0] == -3){
								muts.splice(i,1);
							} else {
								muts.splice(i,1,mt[2]);	
							}
						}
							

					}

					if (draw_flag) {

						this.clearRect(-1 * (w / 2), h / 2, w, -1 * h);
						//drawBlock.call(this);
                                                this.drawBlock()
						
					}

					// Restore the context.
					this.restore();
				}

			};

		});


	};

	/**
	 * Start the effects loop.
	 * Specify number of times to execute, and framerate.
	 */
	$.fn.effectsLoop = function(count, frame_rate) {
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

			// Check framerate
			var frame_rate = frame_rate || 32;


			// Initiate
			context.effects_interval = setInterval( function() {
				context.effects();
			}, frame_rate);

		});

	};


	/**
	 * Halt the effects loop.
	 */
	$.fn.haltEffectsLoop = function(){
		return this.each( function() {
			// Initial checks...
			if (this.context == null) {
				return;
			}

			var context = this.context;

			if(context.effects_interval != null){
				clearInterval(context.effects_interval);
				context.effects_interval = null;
			}

		});
	};


	/**
	 * Initialize colors. TODO: Configurability.
     	 * TODO: Accept a block generator function.
	 */
	$.fn.blockStyle = function() {
		return this.each( function() {

			// Default block drawing func:
                        // TODO: This is an implicit global. It should not need to be.
			this.drawBlock = drawRoundedBlock;

			// Defaulting to tango blue
			this.defaultStyle = tango[6][0];
			this.fillStyle = this.defaultStyle;
			this.color_set = 6;//this.defaultStyle.slice();
			this.shadow_set = 6;

			// Default opacity.
			this.defaultOpacity = 1.0;
			
			// Defaulting to shadows off
			this.shadows = false;
			this.max_shadow = 2;

			this.defaultShadowBlur = this.max_shadow / 2;
			//this.defaultShadow = jlaw_colors[0];
			this.defaultShadow = tango[6][0];

		});

	};

        /**
         * Initialize shadow settings (FF  >=3.5).
         */
        $.fn.blockShadows = function(shadow) {
            return this.each( function() {
                // TODO: Calculate the shadow size and color.
                var ctx = this.context;

                // TODO: Better calculation!
                var shadow = shadow || ctx.block_dimensions[0] - (ctx.block_dimensions[0] * 0.90);

                // Toggle shadows on.
                ctx.shadows = true;
                ctx.max_shadow = shadow;

                ctx.shadowBlur = ctx.defaultShadowBlur;
                ctx.shadowColor = ctx.defaultShadow;
            });
        };


	/**
	 * Initialize block size.
	 */
	$.fn.blockSize = function(x, y) {
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
		return this.each( function() {

			//var radix = block_radix;
			var radix = radix || 15;

			// Make sure the radix given is compatible with the actual block
			// dimensions.
			if (radix > this.block_dimensions[0]) {
				radix = this.block_dimensions[0];
			}
			if (radix > this.block_dimensions[1]) {
				radix = this.block_dimensions[1];
			}

			// TODO: Verify this!
			this.hcoeff_1 = (this.block_dimensions[0] - radix) / this.block_dimensions[0];
			this.vcoeff_1 = (this.block_dimensions[1] - radix) / this.block_dimensions[1];

		});

	};


	/**
	 * Set the block drawing func.
	 */
	//$.fn.setBlockFunc = function(func) {
	//	return this.each( function() {
	//		this.ctx.drawBlock = func;
	//	});
	//};


	/**
	 * Initialize the rendering context.
	 */
	$.fn.initContext = function() {
		return this.each( function() {

			this.context = this.getContext('2d');

			// Set some useful attributes on the context.
			this.context.height = this.height;
			this.context.width = this.width;

			// TODO: Refactor this.
			// TODO: Use inMap and coMap to transform the matrix into a 1d array.
			this.context.coMap = function(x, y){
				return y * this.dimensions[0] + x;
			};
			this.context.inMap = function(ind){
				return [ ind % this.width, ind / this.width ];
			};
			this.context.registerAction = function(x, y){
				if(this.matrix[x][y][1].length > 0){
					this.actions.push([x,y]);
				}
			};
			this.context.addAnim = function(x, y, act){
				this.agrid[this.coMap(x,y)].push(act);

				// Add the pixel to the action stack if necessary.
				//this.registerAction(x, y);
			};
			this.context.setAnim = function(x, y, act_list){
				this.agrid[this.coMap(x,y)] = act_list;
				//this.registerAction(x, y);
			};
			this.context.resetAnim = function(x, y){
				this.agrid[this.coMap(x,y)] = [];
				// TODO: We need to get rid of the reference in this.actions!
			};
			this.context.setState = function(x, y, state){
				this.sgrid[this.coMap(x,y)] = state;
			};
			this.context.getState = function(x, y){
				return this.sgrid[this.coMap(x,y)];
			};
			this.context.setType = function(x, y, type){
				this.tgrid[this.coMap(x,y)] = type;
			};
			this.context.getType = function(x, y){
				return this.tgrid[this.coMap(x,y)];
			};


		});
	};

        /**
         * Initialize a rendering matrix.
         */
        $.fn.buildMatrix = function(x, y) {
            return this.each( function() {
                    var i;

                    this.agrid = new Array(y * x + x);
                    this.sgrid = new Array(y * x + x);				

                    // TODO: Get rid of these and allow users to register their own additional state matrices.
                    this.tgrid = new Array(y * x + x);

                    for(i = 0; i < (y * x + x); i++){
                        this.agrid[i] = [];
                        this.sgrid[i] = 0;
                        this.tgrid[i] = 0;
                    }

                    // TODO: Virtual matrix
                    //this.matrix = function(){


                    // Build the actions stack
                    this.actions = [];

                    // Build command stack.
                    this.cmd_stack = [];

                });

        };


        /**
         * Initialize a rendering grid.
         */
        $.fn.gridSetup = function(x, y, block_radix) {
            return this.each( function() {

                    // Initialize the context for this canvas.
                    $(this).initContext();

                    // Initialize block size,shape,colors,shadows.
                    $(this.context).blockSize(x, y);
                    $(this.context).blockShape(block_radix);
                    $(this.context).blockStyle();
                    //$(this.context).blockShadows();

                    // Build the context grid.
                    $(this.context).buildMatrix(x, y);

                    // Setup the effects.
                    $(this).effectsSetup();

                });
        };


	/////////////////
	// Extras....
	/////////////////


        /**
         * Rendering Helper: Draw a rounded block.
         * 
         */
        drawRoundedBlock = function() {

            // shorthand for the radix coeffs
            var hc1 = this.hcoeff_1;// * 2;
            var vc1 = this.vcoeff_1;// * 2;

            var x = this.block_dimensions[0] / 2 - this.max_shadow;
            var y = this.block_dimensions[1] / 2 - this.max_shadow;

            var xh1 = -1 * x * hc1;
            var xh2 = x * hc1;
            var yh1 = -1 * y * vc1;
            var yh2 = y * vc1;

            this.beginPath();

            this.moveTo(xh2, y);
            this.quadraticCurveTo(x, y, x, yh2);
            this.lineTo(x, yh1);
            this.quadraticCurveTo(x, -1 * y, xh2, -1 * y);
            this.lineTo(xh1, -1 * y);
            this.quadraticCurveTo(-1 * x, -1 * y, -1 * x, yh1);
            this.lineTo(-1 * x, yh2);
            this.quadraticCurveTo(-1 * x, y, xh1, y);

            this.closePath();

            this.fill();

        };


        /**
         * Render a cool ghostly block effect on the selected canvas.
         */
        $.fn.ghostBlocks = function(block_num, duration, speed) {
            return this.each( function() {

                    if (this.context == null) {
                        return;
                    }
                    var context = this.context;

                    speed = speed || 1000;

                    $(this).effectsLoop();

                    // Ghost animation.
                    var opacity = 0.8;

                    var step = 10;

                    //cmd = 'context.matrix'

                    // Template animations.
                    var opFade = opEffect(0.0, opacity, step, opEffect(opacity, 0.0, step, endChain()));
                    var scaleFade = scaleEffect(0.5, 0.5, 1.0, 1.0, step, scaleEffect(1.0, 1.0, 0.5, 0.5, step, endChain()));

                    var ghostFade = [ opFade, scaleFade ];

                    if(context.shadows == true){
                        var end_blur = context.max_shadow - 1;
                        var start_blur = context.defaultShadowBlur;
                        var blurFade = blurEffect(start_blur, end_blur, step, blurEffect(
                                end_blur, start_blur, step, endChain()));
                        ghostFade.push(blurFade);
                    }

                    // Draw random blocks at the specified interval.
                    context.random_interval = setInterval( function() {
                            randomBlock(context, block_num, ghostFade);
                        }, speed);

                    if (duration != null) {
                        setTimeout( 'clearInterval(' + context.random_interval + ')', duration);
                    }

                });
        };

        /**
         * Makes a tile glow when moused over. Optionally, provide an overlay
         * element (the element that actually receives the mouse gestures)
         */
        $.fn.glowTouch = function(canvas_elem, color2, color1) {
            return this.each( function() {

                    if (this.context == null) {
                        return;
                    }
                    var ctx = this.context;

                    color1 = color1 || tango[6][0];
                    color2 = color2 || tango[1][0];

                    // Ensure that the effects loop is initialized (idempotent).
                    // FIXME: Figure out scoping shit here!
                    $(this).effectsLoop();

                    // If no canvas element is specified, assume that this canvas
                    // will receive mouse events.
                    canvas_elem = canvas_elem || this;

                    // One-way fade out animations.
                    var opFadeOut = opEffect(1.0, 0.0, 10, endChain());
                    var colorFadeOut = colorFadeEffect(color2, color1, 10, endChain());
                    var scaleUp = scaleEffect(1.0, 1.0, 0.5, 0.5, 10, endChain());

                    var fadeOutSet = [ opFadeOut, colorFadeOut, scaleUp ];

                    // One-way fade in animations.
                    var opFadeIn = opEffect(0.0, 1.0, 10, endChain());
                    var colorFadeIn = colorFadeEffect(color1, color2, 10, endChain());
                    var scaleOut = scaleEffect(0.5, 0.5, 1.0, 1.0, 10, endChain());

                    var fadeInSet = [ opFadeIn, colorFadeIn, scaleOut ];


                    if(ctx.shadows){
                        var bm = ctx.max_shadow;
                        var blurFadeOut = blurEffect(bm, 0.0, 10, endChain());
                        var shadowFadeOut = shadowColorFadeEffect(color2, color1, 10, endChain());

                        var blurFadeIn = blurEffect(0, bm, 10, endChain());
                        var shadowFadeIn = shadowColorFadeEffect(color1, color2, 10, endChain());

                        fadeOutSet.push(blurFadeOut);
                        fadeOutSet.push(shadowFadeOut);

                        fadeInSet.push(blurFadeIn);
                        fadeInSet.push(shadowFadeIn);

                    }


                    // Handle mouseout events correctly by fading the last piece
                    // touched.
                    $(canvas_elem).mouseout(function() {
                            if (ctx.current_piece != null
                                && ctx.current_piece[0] != -1
                                && ctx.current_piece[1] != -1) {
                                ctx.setAnim(ctx.current_piece[0], ctx.current_piece[1], copyEffect(fadeOutSet));
                                ctx.current_piece = [ -1, -1 ];
                            }

                        });

                    // Fade in the piece the mouse is on, and fade out the last
                    // piece it was on if necessary.
                    $(canvas_elem).mousemove( function(e) {

                            // Determine mouse position
                            var px = e.pageX - this.offsetLeft;
                            var py = e.pageY - this.offsetTop;

                            // Retrieve canvas context
                            // Map mouse to grid box
                            var grid_x = Math.floor((px) / (ctx.block_dimensions[0]));
                            var grid_y = Math.floor((py) / (ctx.block_dimensions[1]));

                            if (ctx.current_piece == null) {
                                ctx.current_piece = [ -1, -1 ];
                            } else if ((ctx.current_piece[0] == grid_x) && (ctx.current_piece[1] == grid_y)) {
                                return;
                            } else {
                                // Do a fade out on the last piece.
                                if ((ctx.current_piece[0] >= 0) && (ctx.current_piece[1] >= 0)) {
                                    ctx.setAnim(ctx.current_piece[0], ctx.current_piece[1], copyEffect(fadeOutSet));
                                }

                                // Set this piece as the current piece.
                                ctx.current_piece[0] = grid_x;
                                ctx.current_piece[1] = grid_y;

                                ctx.setAnim(grid_x, grid_y, copyEffect(fadeInSet));
                            }

                        });

                });
        };


	/**
	 * Draw the Hacker Emblem.
	 * 
	 */
	$.fn.drawGlider = function() {
		return this.each( function() {
			if (this.context == null) {
				return;
			}
			var ctx = this.context;

			$(this).effectsLoop();

                        // Find the top left point of the area we will center the Glider on.
                        var tl = [ Math.floor((ctx.dimensions[0] / 2) - 1),
                                Math.floor((ctx.dimensions[1] / 2) - 1) ];

			// Draw points. (we can copy the effect here with slice(), as
			// the array is flat.)
			var fadeIn = opEffect(0.0, 1.0, 10, -1);

			ctx.addAnim(tl[0] + 1, tl[1], fadeIn.slice());
			ctx.addAnim(tl[0] + 2, tl[1] + 1, fadeIn.slice());
			ctx.addAnim(tl[0], tl[1] + 2, fadeIn.slice());
			ctx.addAnim(tl[0] + 1, tl[1] + 2, fadeIn.slice());
			ctx.addAnim(tl[0] + 2, tl[1] + 2, fadeIn.slice());
			
			ctx.setState(tl[0] + 1, tl[1], 1);
			ctx.setState(tl[0] + 2, tl[1] + 1, 1);
			ctx.setState(tl[0], tl[1] + 2, 1);
			ctx.setState(tl[0] + 1, tl[1] + 2, 1);
			ctx.setState(tl[0] + 2, tl[1] + 2, 1);


			// Animations (copied with copyEffect)
			var step = 10;

			var animSet = [
					colorFadeEffect(tango[6][0], tango[1][0], step, 
						colorFadeEffect(tango[1][0], tango[6][0], step, endChain())),
					scaleEffect(1, 1, 0.75, 0.75, 10, 
						scaleEffect(0.75, 0.75, 1.0, 1.0, 10, endChain())) ];

                	if(ctx.shadows == true){
				var end_blur = ctx.max_shadow;
				var start_blur = ctx.defaultShadowBlur;
				animSet.push(
					shadowColorFadeEffect(tango[6][0], tango[1][0], step, 
						shadowColorFadeEffect(tango[1][0], tango[6][0], step, endChain())));
				animSet.push(
					blurEffect(start_blur, end_blur, step, 
						blurEffect(end_blur, start_blur, step, endChain())));
			}

			var animSet2 = [
					opEffect(0.0, 0.6, 10, opEffect(0.6, 0.0, 10, endChain())),
					scaleEffect(0.25, 0.25, 0.5, 0.5, 10, 
						scaleEffect(0.5, 0.5, 0.25, 0.25, 10, endChain())) ];

			setInterval( function() {
				var used_val = true;
				var px = -1;
				var py = -1;

				do {
					px = Math.floor(Math.random() * ctx.dimensions[0]);
					py = Math.floor(Math.random() * ctx.dimensions[1]);

					if (ctx.getState(px,py) == 1) {
						used_val = false;
					}
					

				} while (used_val)

				ctx.setAnim(px, py, copyEffect(animSet));

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
