TiUI= {};

//
// Adjust content height based on visibility of tab bars
//
TiUI.adjustContentHeight = function()
{
	var tab = $('#tiui_tabbar').css('display');
	var submenu = $('#tiui_content_submenu').css('display');
	
	if (tab == 'block' && submenu == 'block')
	{
		$('#tiui_content_body').css('top','104px')
	}
	else if (tab == 'none' && submenu == 'none')
	{
		$('#tiui_content_body').css('top','53px')
	}
	else
	{
		$('#tiui_content_body').css('top','74px')
	}
};

//
// JS field validator
//
TiUI.validator = function(clazz, callback)
{
//	var EMAIL_REGEX = /^([a-zA-Z0-9_\-\.]+)@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.)|(([a-zA-Z0-9\-]+\.)+))([a-zA-Z]{2,4}|[0-9]{1,3})(\]?)$/,
 	var EMAIL_REGEX = /^([a-zA-Z0-9_\+\-\.]+)@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.)|(([a-zA-Z0-9\-]+\.)+))([a-zA-Z]{2,4}|[0-9]{1,3})(\]?)$/;
	
	function validate()
	{
		var valid = true;
		$('.'+clazz).each(function()
		{
			if ($(this).hasClass('appid'))
			{
				var appid = $(this).val();
			
				if (/^([a-zA-Z][a-zA-Z0-9_]*)(\.[a-zA-Z][a-zA-Z0-9_]*)*$/.test(appid) == false || $(this).hasClass('hinttext') == true)
				{
					valid = false;
					$(this).addClass('tiui_invalid_field');
				}
				else
				{
					$(this).removeClass('tiui_invalid_field');
				}
			}

			if ($(this).hasClass('required'))
			{
				if ($(this).val() == '' || $(this).hasClass('hinttext') == true)
				{
					valid = false;
					$(this).addClass('tiui_invalid_field');
				}
				else
				{
					$(this).removeClass('tiui_invalid_field');
				}
			}
			if ($(this).hasClass('email'))
			{
				if (EMAIL_REGEX.test($(this).val()) == false || $(this).hasClass('hinttext') == true)
				{
					valid = false;
					$(this).addClass('tiui_invalid_field');
				}				
				else
				{
					$(this).removeClass('tiui_invalid_field');
				}
				
			}
		})
		callback(valid);
	};

	$('.' + clazz).keyup(function()
	{
		validate();
	});
	$('.' + clazz).change(function()
	{
		validate();
	});
	
	// perform initial validation
	validate();
	
	return validate;
};

//
// Set background color for content
//
TiUI.setBackgroundColor = function(color)
{
	$('#tiui_content_body').css('backgroundColor',color);
};

//
// Black Gradient Button/Tab Bar
//
TiUI.BlackButtonBar = function()
{
	this.callback = null;
	this.searchCallback = null;
	
	//
	// Search listener
	//
	this.addSearchListener = function(callback)
	{
		this.searchCallback = callback;
	};
	
	// Click listener
	//
	this.addListener = function(callback)
	{
		this.callback = callback;
	};
	
	//
	// show
	//
	this.show = function()
	{
		$('#'+this.id).css('display','block');
		TiUI.adjustContentHeight();
	};

	//
	// hide
	//
	this.hide = function()
	{
		$('#'+this.id).css('display','none');
		TiUI.adjustContentHeight();
	};
	
	//
	// set active tab
	//
	this.setActiveTab = function(idx)
	{
		this.currentActiveIdx = idx;

		$('#' + this.id + ' .tab').each(function()
		{
			if ($(this).attr('idx') == String(idx))
			{
				$(this).addClass('active');
			}
			else
			{
				$(this).removeClass('active');
			}
		})
	};
	
	//
	// Add element to bar
	//
	this.appendContent = function(html)
	{
		$('#'+this.id).append(html)
	};
	
	//
	// Configure
	//
	this.configure = function(options)
	{
		this.id = options.id;
		this.tabs = options.tabs;
		this.active = options.active;
		this.search = (options.search)?options.search:false;
		this.html = '';
		this.currentActiveIdx = -1;
		
		var self = this;
		
		$('#'+this.id).addClass('tiui-content-tabbar');
		$('#'+this.id).addClass('black');

		//
		// create tab markup
		//
		if (this.search==true)
		{
			this.html += '<input type="search" style="width:150px" class="search" placeholder="Search" id="black_button_bar_search"/>';
		}
		
		this.width = (this.tabs.length * 100) + this.tabs.length + 1;
		this.html += '<div style="width:' + this.width + 'px;margin:auto">';
		for (var i=0;i<this.tabs.length;i++)
		{
			var classes= 'tab ';
			if (i==0)
			{
				classes += 'left ';
			}
			if (i==(this.tabs.length-1))
			{
				classes += 'right ';
			}
			if (this.active == i)
			{
				classes+= ' active';
				this.currentActiveIdx = i;
			}
			this.html += '<div idx="'+i+'" class="' + classes + '">'+this.tabs[i] + '</div>';
		}
		this.html += '</div>';
		$('#' + this.id).html(this.html);

		// set search display
		if (this.search)
		{
			$('#black_button_bar_search').css('display','block');
			$('#black_button_bar_search').keyup(function(e)
			{
				if (self.searchCallback && e.keyCode ==13)
				{
					self.searchCallback($('#black_button_bar_search').val(), self.currentActiveIdx);
				}
			})
		}
		else
		{
			$('#black_button_bar_search').css('display','none');
		}
		
		//
		// listener for tab clicks
		//
		$('#'+this.id + ' .tab').click(function()
		{
			$('#'+self.id + ' .tab').removeClass('active');
			$(this).addClass('active')
			if (self.callback != null)
			{
				self.callback(parseInt($(this).attr('idx')));
				self.currentActiveIdx = parseInt($(this).attr('idx'));
			}
		});

		// show
		this.show();

	}
};
TiUI.GreyButton = function(options)
{
	$('#' + options.id).addClass('tiui-button');
	$('#' + options.id).addClass('grey');
	$('#' + options.id).mousedown(function()
	{
		if ($(this).hasClass('disabled'))return;
		$(this).addClass('active')
	});
	$('#' + options.id).mouseup(function()
	{
		$(this).removeClass('active')
	});
	
	
}
//
// Create a grey button tab bar 
//
TiUI.GreyButtonBar = function()
{
	this.callback = null;

	//
	// Add a listener
	//
	this.addListener = function(callback)
	{
		this.callback = callback;
	};

	//
	// Configure
	//
	this.configure = function(options)
	{
		this.id = options.id;
		this.tabs = options.tabs;
		this.activeImages = options.activeImages;
		this.imageTitles = options.imageTitles;
		this.title = options.title;
		this.tabOrButton = (options.tabOrButton)?options.tabOrButton:'button';
		this.active = options.active;
		this.imageOffset = (options.imageOffset)?options.imageOffset:'3px';
		this.tabItemWidth = (options.tabItemWidth)?options.tabItemWidth:30;

		//
		// create markup
		//
		this.html = '<div class="tiui-button-tab-container">';

		var hasText = false;

		for (var i=0;i<this.tabs.length;i++)
		{
			var classes = 'tiui-button-tab';
			var src = this.tabs[i]
			if (i==0) 
			{
				classes += ' left';
			} 
			if (i== (this.tabs.length-1)) 
			{
				classes += ' right';
			}
			if (i==this.active)
			{
				classes += ' active';
				if (this.activeImages)
				{
					src = this.activeImages[i];
				}
			}
			this.html += '<div idx="'+i+'" class="'+ classes + '" style="width:'+this.tabItemWidth+'px">';

			var title = '';

			if (this.imageTitles && this.imageTitles[i])
			{
				title = this.imageTitles[i];
			}
			if (src.text)
			{
				this.html += '<span>'+src.text+'</span></div>';
				hasText = true;
			}
			else
			{
				this.html += '<img src="'+src+'" style="position:relative;top:'+this.imageOffset+'" title="'+title+'"/></div>';
			}
		}
		this.html+='</div>'
		$('#'+this.id).html(this.html);

		//
		// adjust width based on tab count
		//
		this.width = (this.tabs.length * this.tabItemWidth ) + (this.tabs.length+1);
		$('#'+this.id).css('width',this.width + 'px');
		
		//
		// Add title text if specified
		//
		if (this.title)
		{
			$('#'+this.id).append('<div class="tiui-button-tab-title">' + this.title+'</div>');
		}

		//
		// Add listener for click events
		//
		var self = this;
		$('#' + this.id + ' .tiui-button-tab').click(function()
		{
			// add tab behavior
			if (self.tabOrButton == 'tab')
			{
				$('#' + self.id + ' .tiui-button-tab').removeClass('active');
				$(this).addClass('active');
				var idx = $(this).attr('idx');
				
				// if we have active images
				if (self.activeImages)
				{

					// turn off any active ones
					$('#' + self.id + ' .tiui-button-tab').each(function()
					{
						var index = $(this).attr('idx')
						var title = (self.imageTitles)?self.imageTitles[index]:''

						if (index != idx)
						{
							$(this).html('<img title="'+title+'" src="'+self.tabs[index]+'" style="position:relative;top:'+self.imageOffset+'"/>')
						}
					})
					
					// turn on this one
					var title = (self.imageTitles)?self.imageTitles[idx]:''
					$(this).html('<img title="'+title+'" src="'+self.activeImages[idx]+'" style="position:relative;top:'+self.imageOffset+'"/>')
				}
			}
			if (self.callback != null)
			{
				self.callback(parseInt($(this).attr('idx')));
			}
		});

		// add push button behavior
		if (this.tabOrButton == 'button')
		{
			$('.tiui-button-tab').mousedown(function()
			{
				$(this).addClass('pressed');

			});
			$('.tiui-button-tab').mouseup(function()
			{
				$(this).removeClass('pressed');
			});
		}
		
	};
	
	//
	// hide button bar
	//
	this.hide = function()
	{
		$('#'+this.id).css('display','none');
	};

	//
	// show button bar
	//
	this.show = function()
	{
		$('#'+this.id).css('display','block');
	};
	
	return this;
};


//
// Add tabs to the Main Tab Area
//
TiUI.MainTab = function()
{
	this.callback = null;
	//
	// add a click listener
	//
	this.addListener = function(callback)
	{
		this.callback = callback;
	};
	
	//
	// activate tab
	//
	this.activate = function(idx)
	{
		$('.tiui-secondary-tabbar .tab').each(function()
		{
			if ($(this).attr('idx') == String(idx))
			{
				$(this).addClass('active');
			}
			else
			{
				$(this).removeClass('active');
			}
		})
	}
	//
	//  hide tab
	//
	this.hide = function()
	{
		$('#tiui_tabbar').css('display','none');
		$('#tiui_content_body').css('border','1px solid #404040');
		TiUI.adjustContentHeight();
	};
	
	//
	// show tab
	//
	this.show = function()
	{
		$('#tiui_content_body').css('border','none')
		$('#tiui_tabbar').css('display','block');
		TiUI.adjustContentHeight();
	};
	
	//
	// hide a tab
	//
	this.hideTab = function (idx)
	{
		var el = $('.tiui-secondary-tabbar .tab[idx="'+idx+'"]');
		if (el.css('display') != 'none')
		{
			$('.tiui-secondary-tabbar .tab[idx="'+idx+'"]').css('display','none');		
			var w = $('#tiui_tabbar_container').width();	
			$('#tiui_tabbar_container').css('width', (w - 120)  + 'px');
		}	
	};
	
	//
	// show a tab
	//
	this.showTab = function (idx)
	{
	 	var el = $('.tiui-secondary-tabbar .tab[idx="'+idx+'"]');
		if (el.css('display') == 'none')
		{
			el.css('display','block');
			var w = $('#tiui_tabbar_container').width();
			$('#tiui_tabbar_container').css('width', (w + 120)  + 'px');	
		}
	};
	
	this.setLeftPadding = function(amt)
	{
		$("#tiui_tabbar_container").css("padding-left",amt+"px");
	};
	
	//
	// Configure
	//
	this.configure = function(options)
	{
		this.tabs = options.tabs;
		this.active = options.active;
		this.activeIndex = -1;
		this.tabItemWidth = options.tabItemWidth || 120;
		
		// add main class to div
		$('#tiui_tabbar').addClass('tiui-secondary-tabbar');

		//
		// create tab markup
		//
		this.width = (this.tabs.length * this.tabItemWidth) + this.tabs.length + 1;
		// we pad left by 200px since that's the size of the project view and we want to center the tabbar in the center of right pane
		this.html = '<div id="tiui_tabbar_container" style="width:' + this.width + 'px;margin:auto">';
		for (var i=0;i<this.tabs.length;i++)
		{
			var classes= 'tab ';
			if (i==(this.tabs.length-1))
			{
				classes += 'right';
			}
			if (this.active == i)
			{
				this.activeIndex = i;
				classes += ' active';
			}
			this.html += '<div idx="'+i+'" class="' + classes + '">'+this.tabs[i] + '</div>';
		}
		this.html += '</div>';
		$('#tiui_tabbar').html(this.html);
	
		//
		// listener for tab clicks
		//
		var self = this;
		$('.tiui-secondary-tabbar .tab').click(function()
		{
			$('.tiui-secondary-tabbar .tab').removeClass('active');
			$(this).addClass('active')
			if (self.callback != null)
			{
				self.callback(parseInt($(this).attr('idx')));
			}
			this.activeIndex = $(this).attr('idx')
		})	
	};
	
	return this;
};

//
//  Create Tree
//
TiUI.ContentLeft = function()
{
	// clear content
	$('#tiui_content_left_body').empty();

	//
	// Set content
	//
	this.setContent = function(content)
	{
		var html = '<div class="tiui-tree"><div class="body">' + content + '</div></div>';
		$('#tiui_content_left_body').html(html);
	};
	
	//
	// Hide Tree
	//
	this.hide = function(animate)
	{
		//$('.tiui-tree .body').css('display','none');
		$('#tiui_content_left_body').css('display','none');
		
		if (animate ==true)
		{
			// animate
			$('#tiui_content_left').animate({'width':'0px'});
			$('#tiui_content_right').animate({'width':'100%'});
		}
		else
		{
			$('#tiui_content_left').css('width','0px')			
			$('#tiui_content_right').css('width','100%');
		}
		$('#tiui_content_left_body').css('borderRight','none');
	};

	//
	// Show Tree
	//
	this.show = function(animate)
	{
		if (animate ==true)
		{
			$('#tiui_content_right').animate({width:'80%'});
			$('#tiui_content_left').animate({width:'20%'},function()
			{
//				$('.tiui-tree .body').css('display','block');
				$('#tiui_content_left_body').css('display','block');
				
			})
		}
		else
		{
			$('#tiui_content_right').css('width','80%');
			$('#tiui_content_left').css('width','20%')			
//			$('.tiui-tree .body').css('display','block');
			$('#tiui_content_left_body').css('display','block');
			
		}
		$('#tiui_content_left_body').css('borderRight','1px solid #404040');

	};
	
	return this;
};

TiUI.progressBar = 
{
	html:function(msg)
	{
		var html = '';
		if (msg)
		{
			html +='<div style="position:relative;top:-5px;text-align:center">'+msg+'</div>';
		}
		html += '<div id="tiui_progress_bar">';
		for (var i=1;i<12;i++)
		{
			html += '<div style="position:relative;float:left;width:29px;height:5px;border-right:1px solid #c3c6bd;background-color:#737267" class="progress_bar '+i+'"></div>';
		}

		html += '</div>';
		return html;
	},
	init:function()
	{
		var activeState = 0;
		if (this.interval != null) clearInterval(this.interval);
		this.interval = setInterval(function()
		{
			if (activeState != 12) activeState++
			else activeState = 1;
			$('.progress_bar').css('backgroundColor','#737267');		
			$('.progress_bar.' + activeState).css('backgroundColor','#c3c6bd');
			

		},150)
	},
	interval:null
};

//
// Create a Message Area
//
TiUI.MessageArea = function()
{
	this.messages = [];
	this.currentMessage = 0;
	this.defaultMessage = null;
	this.collapsedWidth = '60px';
	this.callback = null;
	var self = this;

	$('#tiui_message_area').addClass('tiui-message-area-container');
	this.html = '<div class="tiui-message-area"><div id="message_area_message" style="position:relative"></div></div>';
	$('#tiui_message_area').append(this.html);	

	// 
	// set collapsed width
	// 
	this.setCollapsedWidth = function(width)
	{
		this.collapsedWidth = width;
	};
	//
	// Set default message
	//
	this.setDefaultMessage = function(msg, cb)
	{
		if (cb)
		{
			this.callback = cb;
		}
		else
		{
			this.callback = null;
		}
		this.defaultMessage = msg;
	};
	
	//
	// Show default message
	//
	this.showDefaultMessage = function()
	{
		$('#message_area_message').html(this.defaultMessage);

		// call callback in case they need to wire listeners
		if (this.callback != null)
		{
			this.callback();
		}
		this.collapse();
	};
	
	//
	// Set a non-rotating message
	// 
	this.setMessage = function(msg)
	{
		$('#message_area_message').html(msg);
	};
	
	//
	// Expand message area
	//
	this.expand = function()
	{
		$('#tiui_message_area').animate({width:'400px'});
	};
	
	//
	// Collapse message area
	//
	this.collapse = function()
	{
		$('#tiui_message_area').animate({width:this.collapsedWidth});
	}
	//
	// Add a message
	//
	this.addMessage = function (msg)
	{
		this.messages.push(msg);
		if (this.messages.length > 1)
		{
			this.startInterval();
		}
		else
		{
			$('#message_area_message').html(msg);
		}
	};
	
	//
	// Remove a message
	//
	this.removeMessage = function(msg)
	{
		var m = this.messages;
		this.messages = [];
		for (var i=0;i<m.length;i++)
		{
			if (m[i]!=msg)
			{
				this.messages.push(m[i])
			}
		}
		
		if (this.messages.length == 1)
		{
			this.cancelInterval();
		}
	};
	
	//
	// Rotate message
	//
	this.rotateMessage = function()
	{
		if (this.currentMessage == (this.messages.length -1))
		{
			this.currentMessage = 0;
		}
		else
		{
			this.currentMessage++;
		}
		$('#message_area_message').animate({top:'-40px'},1000);
		setTimeout(function()
		{
			$('#message_area_message').css('top','0px');
			$('#message_area_message').html(self.messages[self.currentMessage])
			
		},1050)
	};
	
	//
	// Cancel rotation interval
	//
	this.cancelInterval = function()
	{
		cancelInterval(this.interval);
	};
	
	//
	// Start rotation interval
	//
	this.startInterval = function()
	{
		this.interval = setInterval(function()
		{
			self.rotateMessage();
			
		},4000);
	};
	return this;
	
};
