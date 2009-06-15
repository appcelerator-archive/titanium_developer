IRC = {};
IRC.channel = "#titanium_app";
IRC.users = [];
IRC.client = null;
IRC.buttonBar =  new TiUI.BlackButtonBar();
IRC.chats = [];
IRC.state = 'disconnected';
IRC.nick = Titanium.Platform.username;
IRC.candidateNick = null;
IRC.init = false;
IRC.messageCount = 0;
IRC.windowFocused = true;
IRC.isVisible = false;

//
// Main view setup
//
IRC.setupView = function()
{
	TiUI.setBackgroundColor('#1c1c1c');
	TiDev.contentLeft.show();
	TiDev.contentLeftHideButton.show();
	TiDev.contentLeftShowButton.hide();	
	
	// configure button bar
	IRC.buttonBar.configure({id:'irc_tabs',tabs:['Connect','Disconnect'],active:(IRC.state == 'connected')?0:1});
	
	// add tab click listener
	IRC.buttonBar.addListener(function(idx)
	{
		if (idx == 0)
		{
			IRC.connect();
		}
		else
		{
			IRC.disconnect();
		}
	});
	
	// initialize db
	if (IRC.init == false)
	{
		IRC.initDB();
	}

	// add developer count
	IRC.buttonBar.appendContent('<div id="irc_user_count_container" style="position:absolute;right:20px;font-size:11px;color:#fff;display:none"> developers on-line: <span style="color:#42C0FB" id="irc_user_count"></span></div>')
	
	// check state
	if (IRC.state == 'connected')
	{
		// set left cotnent
		IRC.setUsers();
		
		// set main content
		for (var i=0;i<IRC.chats.length;i++)
		{
			$('#irc_window').append(IRC.chats[i]);
		}
		// scroll to the bottom
		$('#irc_window').get(0).scrollTop = $('#irc_window').get(0).scrollHeight;
		
		// update user count
		$('#irc_user_count_container').css('display','block');
		$('#irc_user_count').html(IRC.users.length);
		
	}
	else
	{
		IRC.setDefaultDisplay();
	}
	
	// setup tab listener
	IRC.setupKeyListener();
};

//
// Track window focus events
//
Titanium.UI.currentWindow.addEventListener(function(event)
{
	IRC.messageCount = 0;
	if (event == "focused")
	{
		Titanium.UI.setBadge('');
		IRC.windowFocused = true;
	}
	else
	{
		IRC.windowFocused = false;
	}
});

//
// Initialize db
//
IRC.initDB = function()
{
	// init DB
	try
	{
		var dbrow = TiDev.db.execute("SELECT nick FROM IRC");
		while (dbrow.isValidRow())
		{
			IRC.nick = dbrow.fieldByName('nick');
			IRC.candidateNick = IRC.nick;
			break;
		}
	}
	catch (e)
	{
		TiDev.db.execute("CREATE TABLE IRC (id REAL UNIQUE, nick TEXT)");
		TiDev.db.execute("INSERT INTO IRC (id, nick) values (?,?)",1,IRC.nick)
	}
	
	// add connectivity listener
	$MQL('l:tidev.netchange',function(data)
	{
		if (data.payload.online == false)
		{
			IRC.disconnect();
			IRC.buttonBar.setActiveTab(1);
		}
	});
	
	IRC.init = true;
	
};

//
//  setup a key listener to tab through nicks
//
IRC.setupKeyListener = function()
{
	$('#irc_textfield').keydown(function(e)
	{
		// 
		// handle enter key to send IRC messages
		//
		if (e.keyCode == 13)
		{
			if (IRC.state == 'connected')
			{
				var time = TiDev.getCurrentTime();
				var urlMsg = TiDev.formatURIs($('#irc_textfield').val());
				var rawMsg = $('#irc_textfield').val();

				// no scripts or html
				if (rawMsg.indexOf('</') != -1 || rawMsg.indexOf('<script') != -1 || rawMsg.indexOf('< script') != -1)
				{
					$('#irc_textfield').val('');
					return;
				}

				var formattedMsg = '<div style="color:#ff9900;font-size:14px;float:left;margin-bottom:8px;width:90%">' + IRC.nick + ': <span style="color:white;font-size:12px;font-family:Arial">' + urlMsg + '</span></div><div style="float:right;color:#ccc;font-size:11px;width:10%;text-align:right">'+time+'</div><div style="clear:both"></div>';
			
				if (rawMsg.indexOf('/nick') == 0)
				{
					IRC.candidateNick = rawMsg.split(' ')[1];
					IRC.ircClient.setNick(IRC.candidateNick);
				}
				else
				{
					$('#irc_window').append(formattedMsg);
					IRC.chats.push(formattedMsg);		
					IRC.ircClient.send(IRC.channel,rawMsg);
				}
				$('#irc_textfield').val('');
				$('#irc_window').get(0).scrollTop = $('#irc_window').get(0).scrollHeight;	
			}
			else
			{
				// see if nick request (initial nick was already taken)
				var rawMsg = $('#irc_textfield').val()			
				if (rawMsg.indexOf('/nick') == 0)
				{
					IRC.candidateNick = rawMsg.split(' ')[1];
					IRC.nick = IRC.candidateNick;
					IRC.connect();
					return;
				}
				$('#irc_window').append('<div style="color:#aaa;margin-bottom:20px"> you are not currently connected</div>');
			}
		}
		if (e.keyCode!=9)
		{
			currentSelectionIdx=-1;
			savedPossibilities=null;
			savedName=null;
			return;
		}
		//
		// handle tab key to cycle through nicks
		//
		var prefix = $('#irc_textfield').val();
		if (prefix.length > 0 && savedName && savedName==prefix)
		{
			if (savedPossibilities && currentSelectionIdx!=-1)
			{
				if (currentSelectionIdx + 1 >= savedPossibilities.length)
				{
					currentSelectionIdx = -1;
				}
				var match = savedPossibilities[++currentSelectionIdx];
				savedName = match + ': ';
				$('#irc_textfield').val(savedName);
				return false;
			}
		}
		var users = $('.child div');
		savedPossibilities = [];
		savedName = null;
		currentSelectionIdx = -1;
		for (var c=0;c<users.length;c++)
		{
			var name = users.get(c).innerHTML;
			var idx = name.indexOf(prefix);
			if (idx==0)
			{
				savedPossibilities.push(name);
			}
		}
		if (savedPossibilities.length > 0)
		{
			currentSelectionIdx = 0;
			savedName = savedPossibilities[0] + ': ';
			$('#irc_textfield').val(savedName);
			return false;
		}
	});	
};

//
// set default display when offline
//
IRC.setDefaultDisplay  = function()
{
	// paint tree
	var html = '<div class="parent">DEVELOPERS</div>';
	html += '<div class="child">';
	html += '<div>Not connected to IRC</div></div>';
	
	// set content
	TiDev.contentLeft.setContent(html);
};

//
// Connect to IRC
// 
IRC.connect = function()
{
	IRC.initialize()
	IRC.setUsers();
	$('#irc_user_count_container').css('display','block');
	$('#irc_user_count').html(IRC.users.length);
	TiDev.track('irc-connect');
	
};

//
// Disconnect from IRC
//
IRC.disconnect = function()
{
	if (IRC.ircClient != null)
	{
		IRC.ircClient.disconnect();
		IRC.ircClient = null;
	}
	IRC.state = 'disconnected';
	IRC.users = [];
	$('#irc_window').empty();
	$('#irc_user_count_container').css('display','none');

	if (IRC.isVisible == true)
	{
		IRC.setDefaultDisplay();
	}
};

//
// Add a user to the list
//
IRC.addUser = function(user)
{
	// ensure user doesn't exist
	for (var i=0;i<IRC.users.length;i++)
	{
		// do nothing and return
		if (user == IRC.users[i])
		{
			return;
		}
	}
	IRC.users.push(user);
	$('#irc_user_count').html(IRC.users.length);
	IRC.setUsers();
};

//
// Remove a user from the list
//
IRC.removeUser = function(user)
{
	var newList = []
	// ensure user doesn't exist
	for (var i=0;i<IRC.users.length;i++)
	{
		// do nothing and return
		if (user == IRC.users[i])
		{
			continue;
		}
		newList.push(IRC.users[i]);
	}
	IRC.users = newList;
	$('#irc_user_count').html(IRC.users.length);
	IRC.setUsers();
	
}
//
// Set users' on left
//
IRC.setUsers = function()
{
	if (IRC.isVisible == true)
	{
		var html = '<div class="parent">DEVELOPERS</div>';
		for (var i=0;i<IRC.users.length;i++)
		{
			html += '<div class="child" user_id="'+IRC.users[i]+'">';
			html += '<div>' + IRC.users[i]+ '</div></div>';
		}
		// set content
		TiDev.contentLeft.setContent(html);
	}
};

//
// Format IRC nickname
//
IRC.formatNick =  function(name)
{
 	IRC.nick =  name.replace(/ /g,'_');
	IRC.updateDB();
	return IRC.nick;
};

//
// update db
//
IRC.updateDB = function()
{
	TiDev.db.execute("UPDATE IRC set nick = ? WHERE id = 1", IRC.nick);
};

//
// Initialize IRC client and handle IRC commands
//
IRC.initialize = function()
{
	try
	{
		// clear irc window
		$('#irc_window').empty();
		
		// set name vars
		var username = IRC.formatNick(IRC.nick);

		// intro message
		$('#irc_window').append('<div style="color:#aaa">connecting to the <span style="color:#42C0FB">Titanium Developer</span> IRC channel <span style="color:#42C0FB">'+IRC.channel+'</span>. one moment...</div>');
		
		// connect
		IRC.ircClient = Titanium.Network.createIRCClient();
		IRC.ircClient.connect("irc.freenode.net",6667,username,username,username,String(new Date().getTime()),function(cmd,channel,data,nick)
		{
			var time = TiDev.getCurrentTime();

			// switch on command
			switch(cmd)
			{	
				
				// SOMEONE HAS JOINED THE ROOM
				case 'JOIN':
				{
					if (nick.indexOf('freenode.net') != -1)
					{
						return;
					}

					if (nick == username)
					{
						$('#irc_window').append('<div style="color:#aaa;margin-bottom:20px"> you are now in the room. your handle is: <span style="color:#42C0FB">'+username+'</span>.  You can change your handle using: <span style="color:#42C0FB">/nick new_handle</span></div>');
						IRC.addUser(nick);
						IRC.state = 'connected';						
						return;
					}
					
					$('#irc_window').append('<div style="color:#aaa;margin-bottom:8px">' + nick + ' has joined the room </div>');
					IRC.addUser(nick);
					break;
				}
				// SOMEONE HAS LEFT THE ROOM
				case 'QUIT':
				case 'PART':
				{
					$('#irc_window').append('<div style="color:#aaa;margin-bottom:8px">' + nick + ' has left the room </div>');
					IRC.removeUser(nick)
					break;
				}
				
				// USER LIST
				case '366':
				{	
					var users = IRC.ircClient.getUsers(IRC.channel);
					for (var i=0;i<users.length;i++)
					{
						IRC.addUser(users[i].name);
					}
					break;
				}
				
				// NICK CHANGE
				case 'NICK':
				{
					$('#irc_window').append('<div style="color:#aaa;margin-bottom:8px">' + IRC.nick + ' is now known as <span style"color:#42C0FB">'+IRC.candidateNick+'</span></div>');
					IRC.addUser(IRC.candidateNick);
					IRC.removeUser(IRC.nick);
					IRC.nick = IRC.candidateNick;
					IRC.updateDB();
					break;
				}
				
				// NICK ALREADY IN USE
				case '433':
				{
					$('#irc_window').append('<div style="color:#aaa;margin-bottom:8px">' + IRC.candidateNick + ' is already taken. You can try a new handle using: <span style="color:#42C0FB">/nick new_handle</span>.</div>');
					break;
				}
				
				// INCOMING MESSAGE
				case 'NOTICE':
				case 'PRIVMSG':
				{
					if (nick && nick!='NickServ')
					{
						// update badge is not focused
						if (IRC.windowFocused == false)
						{
							IRC.messageCount++;
							Titanium.UI.setBadge(String(IRC.messageCount));
						}
						
						// format message
						var rawMsg = String(channel.substring(1,channel.length));

						// no scripts or html
						if (rawMsg.indexOf('</') != -1 || rawMsg.indexOf('<script') != -1 || rawMsg.indexOf('< script') != -1)
						{
							return;
						}

						var urlMsg = TiDev.formatURIs(rawMsg);
						var msg = urlMsg.replace(username +":","<span style='color:#42C0FB'>" + username + ": </span>");

						// show notification if window is not focused and message is for users
						var str = username + ":";
						if (IRC.windowFocused == false && msg.indexOf(str) != -1)
						{
							TiDev.showNotification("New Message",msg,true);
						}	
						
						// display message
						var formattedMsg = '<div style="color:#42C0FB;font-size:14px;float:left;margin-bottom:8px;width:90%">' + nick + ': <span style="color:#fff;font-family:Courier;font-size:12px">' + msg + '</span></div><div style="float:right;color:#ccc;font-size:11px;width:10%;text-align:right;position:relative;top:3px">'+time+'</div><div style="clear:both"></div>';
						$('#irc_window').append(formattedMsg);
						IRC.chats.push(formattedMsg);		
						
					}
					break;
				}

			}
			
			$('#irc_window').get(0).scrollTop = $('#irc').get(0).scrollHeight;
		});

		IRC.ircClient.join(IRC.channel);
	}
	catch(E)
	{
	}
	
};

//
// setup event handler
//
IRC.eventHandler = function(event)
{
	IRC.isVisible = true;

	// toggle overflow property (we don't want main body to scroll when we are visible)
	$('#tiui_content_right').css('overflow','hidden');
	
	if (event == 'focus')
	{
		IRC.setupView();
	}
	else if (event == 'load')
	{
		IRC.setupView();
	}
	else
	{
		IRC.buttonBar.hide();
		IRC.isVisible = false;
		$('#tiui_content_right').css('overflow','auto');

	}
};

// register module
TiDev.registerModule({
	name:'irc',
	displayName: 'IRC',
	perspectives:['community'],
	html:'irc.html',
	idx:2,
	callback:IRC.eventHandler
});