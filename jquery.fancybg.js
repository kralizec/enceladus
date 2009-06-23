/*****************************************************************************
 * Fancy Borders/Backgrounds
 * Version: 0.1
 * Jason Lawrence (2009)
 * License: GPLv3
 *
 * 1: Allows for using a canvas as a background.
 * 2: Allows for using a transparent div as a background, to allow for
 *    transparent backgrounds without the use of images.
 * 3: Enables the use of the fancy new border css tricks in any good (non-IE)
 *    browser.
 *
 * TODO: Fix z-index processing!
 * TODO: Testing!
 * TODO: Ensure that CSS id issues don't occur!
 * TODO: Error checking.
 * TODO: Support IE where possible.
 * TODO: Enable element wrapping for inset+outset simultaneous shadow support.
 * TODO: Find a way to store edge rounding data, and update elements with edge
 *       rounding data.
 * TODO: Fix inner shadows system.
 * 
 *****************************************************************************/
( function($) {

	// The default css ID suffix to use.
	var css_id_suffix = '_fancy_bg_container';

	// Default inner shadow div suffix.
	var css_inner_shadow_suffix = '_fb_inner_shadow';

	// Shadow/Border CSS attributes.
	var border_css3 = 'border-radius';
	var shadow_css3 = 'box-shadow';
	var ua_prefixes = {
		css3 : 'box-shadow',
		safari : '-webkit-',
		opera : '-o-',
		mozilla : '-moz-'
	};
	// TODO: Ascertain that this works with other browsers!
	var user_agent = navigator.appCodeName.toLowerCase();

	// Fucking safari telling me its mozilla all the time.
	if ($.browser.safari) {
		user_agent = 'safari';
	}
	var shadow_css = ua_prefixes[user_agent] + shadow_css3;
	var border_css = ua_prefixes[user_agent] + border_css3;

	// if(user_agent == 'webkit'){ alert('Safari!'); }
	// alert(navigator.userAgent);

	/**
	 * Create a wrapper to enable background objects.
	 */
	var wrap_bg = function(node) {
		container = document.createElement('div');
		container.id = node.id + css_id_suffix;
		node.parentNode.replaceChild(container, node);

		$(container).append(node);
	};

	/**
	 * Determine if the object to apply a background to has been properly
	 * wrapped.
	 */
	var is_wrapped = function(node) {
		if (node.parentNode.id != node.id + css_id_suffix) {
			return false;
		}
		return true;
	};

	/**
	 * Create a background canvas for this object. FIXME: No IE support!
	 */
	$.fn.bgCanvas = function(rounding_radius) {
		if ($.browser.msie)
			return;
		return this.each( function() {

			if (!is_wrapped(this)) {
				wrap_bg(this);
			}

			canvas = document.createElement('canvas');

			// if(rounding_radius != null){
				// $(canvas).roundBorder(rounding_radius);
				// }

				// if(canvas_bg_id == null) {
				canvas.id = this.id + "_bg_canvas";
				// } else {
				// canvas.id = canvas_bg_id;
				// }

				$(this).css( {
					zIndex : 1
				});

				canvas.height = this.clientHeight;
				canvas.width = this.clientWidth;
				$(canvas).css( {
					position : "absolute",
					top : this.offsetTop,
					left : this.offsetLeft,
					height : this.clientHeight,
					width : this.clientWidth,
					zIndex : -1
				});

				$(this.parentNode).append(canvas);

			});
	};

	/**
	 * Create a transparent div background for this object.
	 * 
	 */
	$.fn.bgTransparency = function(opacity, color, rounding_radius) {
		return this.each( function() {

			if (!is_wrapped(this)) {
				wrap_bg(this);
			}

			trans_div = document.createElement('div');

			if (rounding_radius != null) {
				$(trans_div).roundBorder(rounding_radius);
			}

			//if(div_bg_id == null){
				trans_div.id = this.id + "_bg_div";
				// } else {
				// trans_div.id = div_bg_id;
				// }

				if (color == null) {
					color = 'black';
				}

				$(trans_div).css( {
					position : "absolute",
					top : this.offsetTop,
					left : this.offsetLeft,
					height : this.clientHeight,
					width : this.clientWidth,
					opacity : opacity,
					backgroundColor : color,
					zIndex : -2

				});

				$(this.parentNode).append(trans_div);

			});
	};

	/**
	 * Outer element shadows.
	 */
	$.fn.outerShadows = function(x_offset, y_offset, blur_radius,
			spread_radius, color) {
		if ($.browser.msie)
			return;
		return this.each( function() {
			// Webkit doesn't support spread_radius yet.
				// TODO: Fix this elegantly
				if (user_agent == 'safari') {
					$(this).css(
							shadow_css,
							[ x_offset + "px", y_offset + "px",
									blur_radius + "px", color ].join(' '));
				} else {
					$(this).css(
							shadow_css,
							[ x_offset + "px", y_offset + "px",
									blur_radius + "px", spread_radius + "px",
									color ].join(' '));
				}
			});
	};

	/**
	 * Inner element shadows.
	 */
	$.fn.innerShadows = function(x_offset, y_offset, blur_radius,
			spread_radius, color) {
		if ($.browser.msie)
			return;
		return this
				.each( function() {

					if (!is_wrapped(this)) {
						wrap_bg(this);
					}

					if ($(this).css(shadow_css) != null) {
						inner_div = document.createElement('div');
						$(inner_div)
								.css(
										shadow_css,
										[ 'inset', x_offset + "px",
												y_offset + "px",
												blur_radius + "px",
												spread_radius + "px", color ]
												.join(' '));

						// Round the borders of the internal shadow div, if
						// necessary.
						// if($(this).css(border_css) != null){
						// $(inner_div).roundBorder(15);
						// }

						$(inner_div).css( {
							height : this.clientHeight,
							width : this.clientWidth,
							position : 'absolute',
							top : this.offsetTop,
							left : this.offsetLeft,
							zIndex : -1
						});

						inner_div.id = this.id + css_inner_shadow_suffix;

						$(this.parentNode).append(inner_div);
					} else {
						$(this)
								.css(
										shadow_css,
										[ 'inset', x_offset + "px",
												y_offset + "px",
												blur_radius + "px",
												spread_radius + "px", color ]
												.join(' '));
					}

				});
	};

	/**
	 * Rounded corners.
	 */
	$.fn.roundBorder = function(r1, r2, r3, r4) {
		if ($.browser.msie)
			return;
		return this.each( function() {
			border_rads = [ r1, r2, r3, r4 ].filter( function(val) {
				if (val == null) {
					return false;
				}
				return true;
			});
			border_rads = border_rads.map( function(val) {
				val += "px";
				return val;
			});
			borders = border_rads.join(' ');
			$(this).css(border_css, borders);
		});
	};

})(jQuery);
