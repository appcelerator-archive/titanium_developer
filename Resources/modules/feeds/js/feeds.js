Feeds = {};
Feeds.buttonBar =  new TiUI.BlackButtonBar();
Feeds.twitterUsername = '';
Feeds.twitterPassword = '';
Feeds.twitterFollowing = false

//
// Hide tweet window
//
Feeds.hideTweet = function()
{
	$('#twitter_fields').css('display','none');
	$('#twitter_console').animate({height:'0px'});	
};

//
// Retrieve twitter creds from DB
//
Feeds.getTwitterCreds = function()
{
	var dbRow = TiDev.db.execute('SELECT twitter, twitter_password FROM USERS');
	while (dbRow.isValidRow())
	{
		Feeds.twitterUsername = dbRow.fieldByName('twitter');
		Feeds.twitterPassword = dbRow.fieldByName('twitter_password');
		break;
	}
};

//
//  Save twitter 
//
Feeds.saveTwitterCreds = function(username, password)
{
	TiDev.db.execute('UPDATE USERS SET twitter = ?, twitter_password = ? ', username,password);
	Feeds.twitterUsername = username;
	Feeds.twitterPassword = password;
};

//
// Send tweet
//
Feeds.sendTweet = function()
{
	// get values
	var tweet = $('#tweet').val();
	var username = $('#twitter_username').val();
	var password = $('#twitter_password').val();
	
	TiDev.track('tweet',{'twitter':username});
	
	// save creds
	Feeds.saveTwitterCreds (username, password);
	
	if (tweet.charAt(0)!='D') //D is direct message if first position
	{
		$.ajax(
		{
			'username':username,
			'password':password,
			'type':'POST', 
			'url':'https://twitter.com/statuses/update.json',
			'data':{'status':tweet, 'source':'titanium developer'},
			success:function(resp,textStatus)
			{
				TiDev.showNotification('Success','Your message was sent!',true);
				Feeds.hideTweet();
			},
			error:function(XMLHttpRequest, textStatus, errorThrown)
			{
				TiDev.showNotification('Error','Sorry there was an error from Twitter!',false);
				Feeds.hideTweet();
			}
		});
	}
	// DIRECT MESSAGE
	else
	{
		var user = tweet.split(' ')[1]
		$.ajax(
		{
			'username':username,
			'password':password,
			'type':'POST', 
			'url':'http://twitter.com/direct_messages/new.json',
			'data':{'text':tweet, 'user':user, 'source': 'titanium developer'},

			success:function(resp,textStatus)
			{
				TiDev.showNotification('Direct Message','Your message was sent!',true);
				Feeds.hideTweet();
			},
			error:function(XMLHttpRequest, textStatus, errorThrown)
			{
				TiDev.showNotification('Direct Message','Sorry there was an error from Twitter!',false);
				Feeds.hideTweet();
			}
		});
	}
};

//
//
// Setup main view
//
Feeds.setupView = function()
{
	// set default UI state
	TiUI.setBackgroundColor('#161616');
	TiDev.contentLeft.hide();
	TiDev.contentLeftHideButton.hide();
	TiDev.contentLeftShowButton.hide();		
	
	// setup tweet buttons
	TiUI.GreyButton({id:'hide_tweet_button'});
	TiUI.GreyButton({id:'send_tweet_button'});
	
	// setup tweet handlers
	$('#hide_tweet_button').click(function()
	{
		Feeds.hideTweet();
	});
	$('#send_tweet_button').click(function()
	{
		if ($(this).hasClass('disabled')) return;
		Feeds.sendTweet();
	});
	
	// setup tweet count
	$('#tweet_count').html('140');
	
	// setup tweet count handler
	$('#tweet').keyup(function()
	{
		var v = $('#tweet').val();
		var l = v.length;
		if (l > 140)
		{
			$('#tweet').val(v.substring(0,140))
		}
		$('#tweet_count').html(140 - $('#tweet').val().length);	
	});
	
	// configure button bar
	//Feeds.buttonBar.configure({id:'tiui_content_submenu',tabs:['Twitter','Friend Feed','Send Tweet'],active:0});
	Feeds.buttonBar.configure({id:'tiui_content_submenu',tabs:['Twitter','Friend Feed'],active:0});
	
	// add date to bar
	Feeds.buttonBar.appendContent('<div style="position:absolute;right:15px;top:1px;font-size:10px;color:#fff" id="feeds_last_update"></div>')

	// add refresh to bar
	Feeds.buttonBar.appendContent('<img style="position:absolute;left:15px;top:6px;cursor:pointer" title="refresh" id="feeds_refresh" src="modules/feeds/images/refresh.png"/>')

	// refresh handler
	$('#feeds_refresh').click(function()
	{
		Feeds.loadTwitter();
	});
	
	// add tab click listener
	Feeds.buttonBar.addListener(function(idx)
	{
		if (idx == 0)
		{
			$('#twitter_content').css('display','block');
			$('#friend_feed_content').css('display','none');
			Feeds.hideTweet();			
		}
		else if (idx == 1)
		{
			$('#twitter_content').css('display','none');
			$('#friend_feed_content').css('display','block');
			Feeds.hideTweet();		
		}
		if (idx == 2)
		{
			$('#tweet').val('');
			$('#twitter_console').animate({height:'225px'});
			$('#twitter_fields').fadeIn();
		}

	});

	// get twitter creds
	if (Feeds.twitterUsername == '')
	{
		Feeds.getTwitterCreds();
	}
	$('#twitter_username').val(Feeds.twitterUsername);
	$('#twitter_password').val(Feeds.twitterPassword);

	// setup validation
	TiUI.validator('send_tweet',function(valid)
	{
		if (valid) 
			$('#send_tweet_button').removeClass('disabled');
		else
			$('#send_tweet_button').addClass('disabled');
	});
	
	Feeds.loadTwitter();
	
};

// setup event handler
Feeds.eventHandler = function(event)
{
	if (event == 'focus')
	{
		Feeds.setupView();
	}
	else if (event == 'load')
	{
		Feeds.setupView();
	}
	else if (event == 'blur')
	{
		Feeds.buttonBar.hide();
	}
};



//
// Load FriendFeed feed
//
Feeds.loadFriendFeed = function()
{
	$('#friend_feed_content').empty();
	var url = "http://friendfeed.com/api/feed/user/titaniumapp?format=json&start=0&num=100";
	
	$.ajax({
		type:"GET",
		url:url,
		success: function(data)
		{
			var json = swiss.evalJSON(data)
			for (var i=0;i<json.entries.length;i++)
			{
				var row = json.entries[i];
				var dateTimeParts = row.updated.split('T');
				var date = dateTimeParts[0];
				var time = dateTimeParts[1];
				var dateParts = date.split('-');
				var date = dateParts[1] + '/' + dateParts[2] + '/' + dateParts[0];
				var time = TiDev.convertDate(time);
				date = date + ' ' + time
				var serviceURL = row.service.profileUrl;
				var title = '<a target="ti:systembrowser" class="ff_clickable" href="'+row.link+'">'+row.title+'</a>';
				var image = null;
				var author = null;
				var sourceImg = null;
				var isTweet = false;
				var url = row.link;
				var html = []

				// flickr search feed
				if (serviceURL.indexOf('flickr')!=-1)
				{
					continue;

				}
				// twitter search feed
				else if (serviceURL.indexOf('twitter')!=-1)
				{
					continue;
				}
				// blogs
				else if (serviceURL.indexOf('blogsearch.google') != -1)
				{
					image = "modules/feeds/images/logo_small.png";
					sourceImg = '<img src="modules/feeds/images/blog_small.png" style="position:relative;top:-2px"/> <span style="color:#a4a4a4;font-size:11px;position:relative;top:-5px"> Blog Article</span>';

				}
				// news
				else if (serviceURL.indexOf('news.google.com')!= -1)
				{
					image = "modules/feeds/images/logo_small.png";
					sourceImg = '<img src="modules/feeds/images/news_small.png" style="position:relative;top:-2px"/> <span style="color:#a4a4a4;font-size:11px;position:relative;top:-5px">News Article</span>';

				}
				// videos
				else if (serviceURL.indexOf('vimeo')!= -1 || serviceURL.indexOf('youtube'))
				{
					image = row.media[0].thumbnails[0].url;
					sourceImg = '<img src="modules/feeds/images/video_small.png" style="position:relative;top:-2px"/> <span style="color:#a4a4a4;font-size:11px;position:relative;top:-5px"> Video</span>';

				}
				
				// feed row markup
				html.push('<div style="height:80px;margin-bottom:10px">');
				html.push('		<table width="100%"><tr><td valign="middle" width="100px" align="center">')
				html.push('		<div><a class="ff_clickable" target="ti:systembrowser" href="'+url+'"><img style="border:2px solid #4b4b4b;background-color:#4b4b4b;position:relative;left:-7px" height="48px" width="48px" src="'+image+'"/></a></div>');
				html.push('		</td><td valign="middle">')
				html.push('		<div style="position:relative;height:80px;-webkit-border-radius:6px;background-color:#414141">');
				html.push('			<img style="position:absolute;left:-24px;top:25px" src="modules/feeds/images/triangle.png"/>');
				html.push('			<div style="color:#42C0FB;position:absolute;left:10px;top:8px;">' + sourceImg+'</div>');
				html.push('			<div style="color:#a4a4a4;font-size:11px;position:absolute;right:10px;top:10px">' + date + '</div>');
				html.push('			<div style="position:absolute;left:10px;top:30px;color:#fff;">'+title +'</div>')
				html.push('		</div></td></tr></table>');
				html.push('</div>');

				$('#friend_feed_content').append(html.join(''));
			}

			$('.ff_clickable').click(function()
			{
				TiDev.track('friendfeed-link-click',{'url':$(this).attr('href')});
			})

		}
	});
}

//
// Load Twitter Feed
//
Feeds.loadTwitter = function()
{
	// clear
	$('#twitter_content').empty();
	
	// set page size
	var rpp = $('#twitter_page_size').val();
	if (!rpp)rpp=50;

	$.ajax({
		type:"GET",
		url: 'http://search.twitter.com/search.rss?q=%22appcelerator%22+OR+%22appcelerator+titanium%22+OR+%40titanium+OR+%40appcelerator+OR+%23titanium+OR+%23appcelerator&rpp=' +rpp ,		
		success: function(data)
		{
	
			var root = data.getElementsByTagName('rss')[0];
			var channels = root.getElementsByTagName("channel");
			var items = channels[0].getElementsByTagName("item");
			for (var i=0;i<items.length;i++)
			{
				var children = items[i].childNodes;
				var date = null;
				var desc = null;
				var image = null;
				var author = null;
				var html = [];
				var link = null;

				for(var j=0;j<children.length;j++)
				{
					if (children[j].nodeType==1)
					{
						switch(children[j].nodeName.toLowerCase())
						{
							case 'link':
							{
								link = children[j].textContent;
								var idx = link.indexOf('statuses');
								link = link.substring(0,idx);
								break;
							}
							case 'author':
							{
								author = children[j].textContent;
								var parts = author.split('(');
								author = parts[1].substring(0,parts[1].length-1)
								break;
							}
							case 'google:image_link':
							{
								image = children[j].textContent.trim();							
								break;
							}

							case 'description':
							{
								desc = children[j].textContent
								desc = desc.replace(/href/g,'class="tw_clickable" target="ti:systembrowser" href');
								desc = desc.replace(/href="\/search/g,'href="http://search.twitter.com/search');
								break;
							}
							case 'pubdate':
							{
								date = children[j].textContent
								var parts = date.split(' ');
								date = parts[2] + ' ' + parts[1] + ' ' + parts[3] + ' ' + TiDev.convertDate(parts[4].substring(0,5));

							}
						}
					}
				}
				html.push('<div style="height:80px;margin-bottom:10px">');
				html.push(	'	<table width="100%"><tr><td valign="middle" align="center" width="100px">');
				html.push('		<div><a href="'+link+'" class="tw_clickable" target="ti:systembrowser"><img style="border:2px solid #4b4b4b;background-color:#4b4b4b;position:relative;left:-7px" height="48px" width="48px" src="'+image+'"/></a></div>');
				html.push('		</td><td valign="middle">')
				html.push('		<div style="position:relative;height:80px;-webkit-border-radius:6px;background-color:#414141">');
				html.push('			<img style="position:absolute;left:-24px;top:25px" src="modules/feeds/images/triangle.png"/>');
				html.push('			<div style="position:absolute;left:10px;top:8px;"><a target="ti:systembrowser" class="tw_clickable" href="'+link+'">' + author + '</a> <span style="color:#a4a4a4;font-size:12px">says:</span></div>');
				html.push('			<div style="color:#a4a4a4;font-size:11px;position:absolute;right:10px;top:10px">' + date + '</div>');
				html.push('			<div style="position:absolute;left:10px;top:30px;color:#fff;font-size:12px">'+desc +'</div>')
				html.push('		</div></td></tr></table>');
				html.push('</div>');

				$('#twitter_content').append(html.join(''));
				var d = new Date();	
				$('#feeds_last_update').html(d.toLocaleString())
				
			}

			$('.tw_clickable').click(function()
			{
				TiDev.track('twitter-link-click',{'url':$(this).attr('href')});
			})

			// load after return - keep
			// browser threads free
			Feeds.loadFriendFeed();

		}
	});
}

//
// Set interval to load feeds
//
setInterval(function()
{
	Feeds.loadTwitter();

},300000)



// register module
TiDev.registerModule({
	name:'feeds',
	displayName: 'Feeds',
	perspectives:['community'],
	html:'feeds.html',
	idx:0,
	active:true,
	callback:Feeds.eventHandler
});
