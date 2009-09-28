/**
 * Some of this code was modeled after the Facebook AIR application and
 * is re-licensed by Appcelerator under the same license.
 *
 * Copyright Facebook Inc.
 * Copyright Appcelerator, Inc.
 * 
 *	 Licensed under the Apache License, Version 2.0 (the "License");
 *		you may not use this file except in compliance with the License.
 *	 You may obtain a copy of the License at
 * 
 *	 http://www.apache.org/licenses/LICENSE-2.0
 * 
 *	 Unless required by applicable law or agreed to in writing, software
 *	 distributed under the License is distributed on an "AS IS" BASIS,
 *	 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *	 See the License for the specific language governing permissions and
 *	 limitations under the License.
 *
 *	 @Author Jeff Haynie <jhaynie@appcelerator.com>
 * 
 *
 * This API provides a pure JavaScript API to Facebook Connect such that it 
 * can be used in Appcelerator Titanium
 *
 */
Titanium.Facebook = {};

/**
 * Main API entry point for creating an Facebook Connect API session
 *
 * Pass in your applications API key and callback function to receive
 * the facebook session object once the session has been created
 */
Titanium.Facebook.createSession = function(apikey,cb)
{
	this.NOT_LOGGED_IN = 0;
	this.LOGGED_IN = 1;
	
	this.status = this.NOT_LOGGED_IN;

//	var is_desktop = (Titanium.platform == 'osx' || Titanium.platform == 'win32' || Titanium.platform == 'linux');
	var is_desktop = false;
	
	var FacebookRestURL = "http://api.facebook.com/restserver.php";
	var FacebookURL = "http://www.facebook.com";
	var LoggedInPath = FacebookURL + "/extern/desktop_login_status.php";
	var extraParams =	 {
			v: "1.0",
			fbconnect: true,
			nochrome: true,
			connect_display: is_desktop ? "popup" : "touch",
			display: is_desktop ? "popup" : "touch",
			next: FacebookURL + "/connect/login_success.html",
			return_session: true,
			cancel_url: FacebookURL + "/connect/login_failure.html"
	};
	var dialog_width = is_desktop ? 532	 : 320;
	var dialog_height = is_desktop ? 437 : 480;
	var permissions = [];
	var validating_permissions;
	var callCount = 0;
	var datePrefix = String((new Date()).getTime());

	this.session = null;

	var db = Titanium.Database.open("ti_fbconnect");
	db.execute("CREATE TABLE IF NOT EXISTS sessions (apikey TEXT,session_key TEXT,uid TEXT, expires TEXT, secret TEXT, email TEXT)");
	
	var rs = db.execute("SELECT * FROM sessions where apikey = ?",apikey);
	while(rs.isValidRow())
	{
		if (new Date().getTime() < rs.field(3))
		{
			this.status = this.LOGGED_IN;
			this.session = {};
			this.session['session_key'] = rs.field(1);
			this.session['uid'] = rs.field(2);
			this.session['expires'] = rs.field(3);
			this.session['secret'] = rs.field(4);
			this.session['email'] = rs.field(5);
		}
		else
		{
			this.status = this.NOT_LOGGED_IN;
		}
		break;
	}

	function trim() {
		return s.replace(/^\s+|\s+$/g,"");
	};
	
	function makeURLParams() {
		var o = {};
		for (var k in extraParams)
		{
			o[k]=extraParams[k];
		}
		return o;
	};
	
	function encodeURLParams(o) {
		var location = '';
		for (var key in o)
		{
			location += "&" + key + "=" + o[key];
		}
		return location;
	};
	
	function makeRestURL(o) {
		return FacebookRestURL + "?" + encodeURLParams(o);
	};
	
	function makeURL(path,o) {
		return FacebookURL + path + encodeURLParams(o);
	};
	
	function isArray(obj) {
		return (String(obj.constructor).indexOf('Array()')!=-1);
	};

	function isSimple(o) {
		switch(typeof(o))
		{
			case 'string':
			case 'number':
			case 'boolean':
			{
				return true;
			}
			case 'object':
			{
				if (isArray(o) || typeof(o.toUTCString)=='function')
				{
					return true;
				}
				break;
			}
		}
		return false;
	};
	
	function flattenArgs(method,callArgs,is_fql) {
		var urlArgs = {};
		 callCount++;
		 if (callArgs) {
			  for (var key in callArgs) {
				var value = callArgs[key];
				if (isArray(value)) {
					urlArgs[key]=value.join(",");
				}
				else if (isSimple(value))
				{
					urlArgs[key]=value;
				}
				else {
					urlArgs[key]=Titanium.JSON.stringify(value);
				}
			}
		}
		urlArgs['v'] = '1.0';
		urlArgs['format'] = 'JSON';
		if (is_fql)
		{
			urlArgs['method'] = 'fql.query';
			urlArgs['query'] = method;
		}
		else
		{
			urlArgs['method'] = method;
		}
		urlArgs['api_key'] = apikey;
		urlArgs['call_id'] = datePrefix + callCount;
		urlArgs['ss'] = true;
		if (self.session)
		{
			urlArgs['session_key'] = self.session.session_key;
		}

		var argsArray = [];
		for (var k in urlArgs)
		{
			argsArray.push(k+"="+urlArgs[k]);
		}
		argsArray.sort();
		if (self.session)
		{
			var hashString = argsArray.join("") + self.session.secret;
			urlArgs['sig'] = hex_md5(hashString);
		}
		return urlArgs;
	};
	
	var self = this;
	
	this.isLoggedIn = function() {
		return this.status == this.LOGGED_IN;
	};
	
	this.getUserEmail = function() { 
		return this.isLoggedIn() ? this.session.email : null;
	};
	
	this.logout = function(callback) {
		self.callMethod("auth.expireSession",null,function()
		{
			self.status = this.NOT_LOGGED_IN;
			self.session = null;
			db.execute("DELETE FROM sessions where apikey = ?",apikey);
			if (typeof(callback)=='function')
			{
				callback();
			}
		});
	};
	
	function invokeRemote(urlArgs,callback)
	{
		try
		{
			var xhr = Titanium.Network.createHTTPClient();
			xhr.onreadystatechange = function()
			{
				if (this.readyState == 4)
				{
					var ct = this.getResponseHeader("Content-Type");
					console.debug("response was: "+this.responseText+", "+ct);
					var response = this.responseText;
					if (ct.indexOf('/json')!=-1)
					{
						try
						{
							response = Titanium.JSON.parse(this.responseText);
						}
						catch(e)
						{
							// FB says it's json but it's not often
						}
					}
					if (typeof(callback)=='function') callback(response);
				}
			};
			var url = makeRestURL(urlArgs);
			console.debug("url = "+url);
			xhr.open("GET",url);
			xhr.setRequestHeader("Content-Type","application/x-www-form-urlencoded");
			xhr.send(null);
		}
		catch(E)
		{
			console.error("Facebook Connect Error = "+E);
		}
	}
	
	// get the logged in user's UID
	this.getUID = function() {
		if (this.status == this.LOGGED_IN) {
			return this.session.uid;
		}
	};
	
	// invoke FQL 
	this.query = function(fql,callback) {
		var urlArgs = flattenArgs(fql, null, true);
		invokeRemote(urlArgs,callback);
	};
	
	// invoke FB method
	this.callMethod = function(method,callArgs,callback) {
		if (typeof(callArgs)=='function')
		{
			callback = callArgs;
			callArgs = null;
		}
		var urlArgs = flattenArgs(method, callArgs, false);
		invokeRemote(urlArgs,callback);
	};
	
	this.hasPermission = function (permission_name) {
		return (permissions.indexOf(permission_name) != -1);
	 };

	 // Called internally when we've discovered we're unauthenticated
	 function unauthenticated() {
		validating_permissions = null;
		self.session = null;
		self.status = self.NOT_LOGGED_IN;
	 };

	function getPermissions(permissions_needed, callback) {
		var p = makeURLParams();
		p["next"] = p["next"] + "?xxRESULTTOKENxx";
		p["extern"] = 1;
		p["ext_perm"] = permissions_needed.join(",");
		var location = makeURL("/connect/prompt_permissions.php?api_key="+apikey,p);
		showDialog(location,dialog_width,dialog_height,extraParams.next,extraParams.cancel_url,function(ok,url,vars)
		{
			callback(ok,url,vars);
		});
	};

	 // Callback when desktop_login_status has confirmed our login
	 // We confirm our uid and proceed with PermDialog or we bail
	 function confirmedLoggedIn (url, permissions_needed, callback) {
		var uid_pattern = /uid=(\d+)/;
		var uid = Number(uid_pattern.exec(url)[1]);
		if (uid != self.session.uid) {
			unauthenticated();
			callback(false);
		} 
		else 
		{
			getPermissions(permissions_needed,callback);
		}
	 };
	 
	
	this.requirePermissions = function(permission_names, callback) {
		if (!self.session || !self.session.uid)
		{
			self.login(function(login_result,url)
			{
				if (login_result)
				{
					self.requirePermissions(permission_names,callback);
				}
				else
				{
					callback(false);
				}
			});
			return;
		}
		// check to see if we're already doing this
		if (validating_permissions) return;
			validating_permissions = permission_names;
			this.callMethod("fql.query", {query:"select " + permission_names.join(", ") + " from permissions where uid = " + self.session.uid }, 
		function(result)
		{
			var permissions_granted = result[0];
				// Update our cache of what we know about these permissions
			for (var permission_granted in permissions_granted)
			{
				  if (permissions_granted[permission_granted] == 1 &&
						permissions.indexOf(permission_granted) == -1)
					 permissions.push(permission_granted);
				  else if (permissions_granted[permission_granted] == 0 &&
							  permissions.indexOf(permission_granted) != -1)
					 permissions.splice(permissions.indexOf(permission_granted), 1);
			}
				// Check to see if we need more
			 var permissions_needed= [];
			for (var c=0;c<validating_permissions.length;c++)
			{
				var validating_permission = validating_permissions[c];
				if (!self.hasPermission(validating_permission))
					 permissions_needed.push(validating_permission);
			}
			
			if (permissions_needed.length == 0) 
			{
				validating_permissions = null;
				callback(true);
			} 
			else 
			{
				if (!self.isLoggedIn())
				{
					self.login(function(login_result,url)
					{
						if (login_result)
						{
							confirmedLoggedIn(url,permissions_needed,callback);
						}
						else
						{
							callback(false);
						}
					});
				}
				else
				{
					// logged in
					getPermissions(permissions_needed,callback);
				}
			}
		});
	};
	
	function showDialog(location,width,height,next,cancel,callback)
	{
		// var progress_win = Titanium.UI.createWindow("app://progress.html");
		// progress_win.setHeight(150);
		// progress_win.setWidth(450);
		// progress_win.setResizable(false);
		// progress_win.setMaximizable(false);
		// progress_win.setMinimizable(false);
		// progress_win.setTopMost(true);
		// progress_win.setCloseable(false);
		// progress_win.setUsingChrome(false);
		// progress_win.addEventListener(function(e)
		// {
		// 	if (e.getType() == e.PAGE_LOADED)
		// 	{
		// 		e.scope.document.body.innerHTML = "One Moment";
		// 	}
		// });
		// progress_win.setVisible(true);
		// progress_win.open();
		
		console.debug(location);
		var win = Titanium.UI.createWindow(location);
		var pending_email = null;
		var pending_pass = null;
		win.setWidth(width);
		win.setHeight(height);
		win.addEventListener(function(e)
		{
			if (e.getType() == e.PAGE_LOADED)
			{
				var ok = false;
				var vars = null;
				if (e.url.match("^"+next))
				{
					vars = {};
					var idx = e.url.indexOf('?');
					var qs = e.url.substring(idx+1);
					var tokens = qs.split("&");
					for (var c=0;c<tokens.length;c++)
					{
						var t = tokens[c].split("=");
						vars[decodeURIComponent(t[0])] = t.length > 1 ? decodeURIComponent(t[1]) : "";
					}
					// remember our session email
					ok = true;
				}
				else if (e.url.match("^"+cancel))
				{
					ok = false;
				}
				else
				{
					//login dialog
					win.setVisible(true);
					
					// setup onunload handler to yank email out
					e.scope.onunload = function()
					{
						pending_email = e.scope.document.getElementById("email").value;
						pending_pass = e.scope.document.getElementById("pass").value;
					};
					return;
				}
				win.close();
				callback(ok,e.url,vars,pending_email,pending_pass);
			}
		});
		win.setVisible(false);
		if (is_dekstop)
		{
			win.open();
		}
		else
		{
			win.open({modal:true});
		}
	};
	
	this.login = function(callback) {
		var p = makeURLParams();
		var location = makeURL("/login.php?api_key=" + apikey,p);
		showDialog(location,dialog_width,dialog_height,extraParams.next,extraParams.cancel_url,function(ok,url,vars,email,pass)
		{
			db.execute("DELETE FROM sessions where apikey = ?",apikey);
			if (ok)
			{
				self.session = Titanium.JSON.parse(vars.session);
				self.session.email = email;
				self.status = self.LOGGED_IN;
				db.execute("INSERT INTO sessions VALUES (?,?,?,?,?,?)",apikey,self.session['session_key'],self.session['uid'],self.session['expires'],self.session['secret'],self.session['email']);
			}
			else
			{
				self.status = self.NOT_LOGGED_IN;
				self.session = null;
			}
			callback(ok,url,vars,email,pass);
		});
	};
	
	//
	// publish a feed item - will prompt for feed permission dialog
	//
	this.publishFeed = function(template_id, template_data, body_general, callback) {
		var data = {};
		if (template_id) data.template_id = template_id;
		if (template_data) data.template_data = template_data;
		if (body_general) data.body_general = body_general;
		var p = makeURLParams();
		p.feed_info = encodeURIComponent(Titanium.JSON.stringify(data));
		p.feed_target_type = 'self_feed';
		p.preview = '1';
		var location = makeURL("/connect/prompt_feed.php?api_key=" + apikey,p);
		showDialog(location,535,205,extraParams.next,extraParams.cancel_url,function(ok,url,vars)
		{
			callback(ok);
		});
	};

	/*
	 * A JavaScript implementation of the RSA Data Security, Inc. MD5 Message
	 * Digest Algorithm, as defined in RFC 1321.
	 * Version 2.1 Copyright (C) Paul Johnston 1999 - 2002.
	 * Other contributors: Greg Holt, Andrew Kepert, Ydnar, Lostinet
	 * Distributed under the BSD License
	 * See http://pajhome.org.uk/crypt/md5 for more info.
	 */
	var hexcase = 0;	
	var b64pad	= ""; 
	var chrsz	= 8; 
	function hex_md5(s){ return binl2hex(core_md5(str2binl(s), s.length * chrsz));}
	function binl2hex(binarray)
	{
	  var hex_tab = hexcase ? "0123456789ABCDEF" : "0123456789abcdef";
	  var str = "";
	  for(var i = 0; i < binarray.length * 4; i++)
	  {
		 str += hex_tab.charAt((binarray[i>>2] >> ((i%4)*8+4)) & 0xF) +
				  hex_tab.charAt((binarray[i>>2] >> ((i%4)*8	 )) & 0xF);
	  }
	  return str;
	}
	function str2binl(str)
	{
	  var bin = Array();
	  var mask = (1 << chrsz) - 1;
	  for(var i = 0; i < str.length * chrsz; i += chrsz)
		 bin[i>>5] |= (str.charCodeAt(i / chrsz) & mask) << (i%32);
	  return bin;
	}
	function core_md5(x, len)
	{
	  /* append padding */
	  x[len >> 5] |= 0x80 << ((len) % 32);
	  x[(((len + 64) >>> 9) << 4) + 14] = len;

	  var a =  1732584193;
	  var b = -271733879;
	  var c = -1732584194;
	  var d =  271733878;

	  for(var i = 0; i < x.length; i += 16)
	  {
		 var olda = a;
		 var oldb = b;
		 var oldc = c;
		 var oldd = d;

		 a = md5_ff(a, b, c, d, x[i+ 0], 7 , -680876936);
		 d = md5_ff(d, a, b, c, x[i+ 1], 12, -389564586);
		 c = md5_ff(c, d, a, b, x[i+ 2], 17,  606105819);
		 b = md5_ff(b, c, d, a, x[i+ 3], 22, -1044525330);
		 a = md5_ff(a, b, c, d, x[i+ 4], 7 , -176418897);
		 d = md5_ff(d, a, b, c, x[i+ 5], 12,  1200080426);
		 c = md5_ff(c, d, a, b, x[i+ 6], 17, -1473231341);
		 b = md5_ff(b, c, d, a, x[i+ 7], 22, -45705983);
		 a = md5_ff(a, b, c, d, x[i+ 8], 7 ,  1770035416);
		 d = md5_ff(d, a, b, c, x[i+ 9], 12, -1958414417);
		 c = md5_ff(c, d, a, b, x[i+10], 17, -42063);
		 b = md5_ff(b, c, d, a, x[i+11], 22, -1990404162);
		 a = md5_ff(a, b, c, d, x[i+12], 7 ,  1804603682);
		 d = md5_ff(d, a, b, c, x[i+13], 12, -40341101);
		 c = md5_ff(c, d, a, b, x[i+14], 17, -1502002290);
		 b = md5_ff(b, c, d, a, x[i+15], 22,  1236535329);

		 a = md5_gg(a, b, c, d, x[i+ 1], 5 , -165796510);
		 d = md5_gg(d, a, b, c, x[i+ 6], 9 , -1069501632);
		 c = md5_gg(c, d, a, b, x[i+11], 14,  643717713);
		 b = md5_gg(b, c, d, a, x[i+ 0], 20, -373897302);
		 a = md5_gg(a, b, c, d, x[i+ 5], 5 , -701558691);
		 d = md5_gg(d, a, b, c, x[i+10], 9 ,  38016083);
		 c = md5_gg(c, d, a, b, x[i+15], 14, -660478335);
		 b = md5_gg(b, c, d, a, x[i+ 4], 20, -405537848);
		 a = md5_gg(a, b, c, d, x[i+ 9], 5 ,  568446438);
		 d = md5_gg(d, a, b, c, x[i+14], 9 , -1019803690);
		 c = md5_gg(c, d, a, b, x[i+ 3], 14, -187363961);
		 b = md5_gg(b, c, d, a, x[i+ 8], 20,  1163531501);
		 a = md5_gg(a, b, c, d, x[i+13], 5 , -1444681467);
		 d = md5_gg(d, a, b, c, x[i+ 2], 9 , -51403784);
		 c = md5_gg(c, d, a, b, x[i+ 7], 14,  1735328473);
		 b = md5_gg(b, c, d, a, x[i+12], 20, -1926607734);

		 a = md5_hh(a, b, c, d, x[i+ 5], 4 , -378558);
		 d = md5_hh(d, a, b, c, x[i+ 8], 11, -2022574463);
		 c = md5_hh(c, d, a, b, x[i+11], 16,  1839030562);
		 b = md5_hh(b, c, d, a, x[i+14], 23, -35309556);
		 a = md5_hh(a, b, c, d, x[i+ 1], 4 , -1530992060);
		 d = md5_hh(d, a, b, c, x[i+ 4], 11,  1272893353);
		 c = md5_hh(c, d, a, b, x[i+ 7], 16, -155497632);
		 b = md5_hh(b, c, d, a, x[i+10], 23, -1094730640);
		 a = md5_hh(a, b, c, d, x[i+13], 4 ,  681279174);
		 d = md5_hh(d, a, b, c, x[i+ 0], 11, -358537222);
		 c = md5_hh(c, d, a, b, x[i+ 3], 16, -722521979);
		 b = md5_hh(b, c, d, a, x[i+ 6], 23,  76029189);
		 a = md5_hh(a, b, c, d, x[i+ 9], 4 , -640364487);
		 d = md5_hh(d, a, b, c, x[i+12], 11, -421815835);
		 c = md5_hh(c, d, a, b, x[i+15], 16,  530742520);
		 b = md5_hh(b, c, d, a, x[i+ 2], 23, -995338651);

		 a = md5_ii(a, b, c, d, x[i+ 0], 6 , -198630844);
		 d = md5_ii(d, a, b, c, x[i+ 7], 10,  1126891415);
		 c = md5_ii(c, d, a, b, x[i+14], 15, -1416354905);
		 b = md5_ii(b, c, d, a, x[i+ 5], 21, -57434055);
		 a = md5_ii(a, b, c, d, x[i+12], 6 ,  1700485571);
		 d = md5_ii(d, a, b, c, x[i+ 3], 10, -1894986606);
		 c = md5_ii(c, d, a, b, x[i+10], 15, -1051523);
		 b = md5_ii(b, c, d, a, x[i+ 1], 21, -2054922799);
		 a = md5_ii(a, b, c, d, x[i+ 8], 6 ,  1873313359);
		 d = md5_ii(d, a, b, c, x[i+15], 10, -30611744);
		 c = md5_ii(c, d, a, b, x[i+ 6], 15, -1560198380);
		 b = md5_ii(b, c, d, a, x[i+13], 21,  1309151649);
		 a = md5_ii(a, b, c, d, x[i+ 4], 6 , -145523070);
		 d = md5_ii(d, a, b, c, x[i+11], 10, -1120210379);
		 c = md5_ii(c, d, a, b, x[i+ 2], 15,  718787259);
		 b = md5_ii(b, c, d, a, x[i+ 9], 21, -343485551);

		 a = safe_add(a, olda);
		 b = safe_add(b, oldb);
		 c = safe_add(c, oldc);
		 d = safe_add(d, oldd);
	  }
	  return Array(a, b, c, d);

	}
	function md5_cmn(q, a, b, x, s, t)
	{
	  return safe_add(bit_rol(safe_add(safe_add(a, q), safe_add(x, t)), s),b);
	}
	function md5_ff(a, b, c, d, x, s, t)
	{
	  return md5_cmn((b & c) | ((~b) & d), a, b, x, s, t);
	}
	function md5_gg(a, b, c, d, x, s, t)
	{
	  return md5_cmn((b & d) | (c & (~d)), a, b, x, s, t);
	}
	function md5_hh(a, b, c, d, x, s, t)
	{
	  return md5_cmn(b ^ c ^ d, a, b, x, s, t);
	}
	function md5_ii(a, b, c, d, x, s, t)
	{
	  return md5_cmn(c ^ (b | (~d)), a, b, x, s, t);
	}
	function core_hmac_md5(key, data)
	{
	  var bkey = str2binl(key);
	  if(bkey.length > 16) bkey = core_md5(bkey, key.length * chrsz);

	  var ipad = Array(16), opad = Array(16);
	  for(var i = 0; i < 16; i++)
	  {
		 ipad[i] = bkey[i] ^ 0x36363636;
		 opad[i] = bkey[i] ^ 0x5C5C5C5C;
	  }

	  var hash = core_md5(ipad.concat(str2binl(data)), 512 + data.length * chrsz);
	  return core_md5(opad.concat(hash), 512 + 128);
	}
	function safe_add(x, y)
	{
	  var lsw = (x & 0xFFFF) + (y & 0xFFFF);
	  var msw = (x >> 16) + (y >> 16) + (lsw >> 16);
	  return (msw << 16) | (lsw & 0xFFFF);
	}
	function bit_rol(num, cnt)
	{
	  return (num << cnt) | (num >>> (32 - cnt));
	}
	
	
	if (this.status == this.LOGGED_IN)
	{
		this.callMethod("users.getLoggedInUser",function(data)
		{
			if (self.session && self.session.uid!=data)
			{
				self.status = this.NOT_LOGGED_IN;
				self.session = null;
			}
			cb(self);
		});
	}
	else
	{
		cb(this);
	}
	
	return null;
};

