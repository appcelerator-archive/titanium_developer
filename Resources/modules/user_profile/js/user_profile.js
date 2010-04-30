UserProfile = {};
UserProfile.updateURL = 'user-profile-update';
UserProfile.defaultValues = {
	'email':'required',
	'password':'required'
};

UserProfile.user = {};

//
// method is called when receiving details from backend so that
// they can be updated on the front-end in case the user has updated their
// profile on the website
//
UserProfile.updateUser = function(email,data)
{
	UserProfile.user['email']  = email;
	
	try
	{
		var dbrow = TiDev.db.execute("select password from USERS where email = ?", email);
		while (dbrow.isValidRow())
		{
			UserProfile.user['password']  = dbrow.fieldByName('password');
			$('#user_profile_password').val(UserProfile.user['password']).removeClass('tiui_invalid_field');
			break;
		}
	}
	catch(E)
	{
	}
	
	for(var name in data)
	{
		var value = data[name];
		switch(name)
		{
			case 'firstname':
			{
				$('#user_profile_fname').val(value).removeClass('tiui_invalid_field');
				TiDev.db.execute('UPDATE USERS SET fname = ? where email = ?',value,email);
				UserProfile.user['fname']  = value;
				break;
			}
			case 'lastname':
			{
				$('#user_profile_lname').val(value).removeClass('tiui_invalid_field');
				TiDev.db.execute('UPDATE USERS SET lname = ? where email = ?',value,email);
				UserProfile.user['lname']  = value;
				break;
			}
			case 'twitter':
			{
				$('#user_profile_twitter').val(value).removeClass('tiui_invalid_field');
				TiDev.db.execute('UPDATE USERS SET twitter = ? where email = ?',value,email);
				UserProfile.user['twitter']  = value;
				break;
			}
			case 'organization':
			{
				$('#user_profile_org').val(value).removeClass('tiui_invalid_field');
				TiDev.db.execute('UPDATE USERS SET organization = ? where email = ?',value,email);
				UserProfile.user['organization']  = value;
				break;
			}
			case 'city':
			{
				$('#user_profile_city').val(value).removeClass('tiui_invalid_field');
				TiDev.db.execute('UPDATE USERS SET city = ? where email = ?',value,email);
				UserProfile.user['city']  = value;
				break;
			}
			case 'state':
			{
				$('#user_profile_state').val(value).removeClass('tiui_invalid_field');
				TiDev.db.execute('UPDATE USERS SET state = ? where email = ?',value,email);
				UserProfile.user['state']  = value;
				break;
			}
			case 'country':
			{
				$('#user_profile_country').val(value).removeClass('tiui_invalid_field');
				TiDev.db.execute('UPDATE USERS SET country = ? where email = ?',value,email);
				UserProfile.user['country']  = value;
				break;
			}
		}
	}
	
};

//
// insert a new row
//
UserProfile.insertRow = function()
{
	TiDev.db.execute('INSERT INTO USERS (fname, lname, email, password, organization, city, state, country, twitter) VALUES (?,?,?,?,?,?,?,?,?)',
		$('#user_profile_fname').val(),$('#user_profile_lname').val(),$('#user_profile_email').val(), 
		$('#user_profile_password').val(), $('#user_profile_org').val(), $('#user_profile_city').val(),
		$('#user_profile_state').val(), $('#user_profile_country').val(), $('#user_profile_twitter').val());
};

//
// update row
//
UserProfile.updateRow = function()
{
	TiDev.db.execute('UPDATE USERS SET fname = ?, lname = ?, email = ?, password = ?, organization = ?, city = ?, state = ?, country = ?, twitter = ?',
		$('#user_profile_fname').val(),$('#user_profile_lname').val(),$('#user_profile_email').val(), 
		$('#user_profile_password').val(), $('#user_profile_org').val(), $('#user_profile_city').val(),
		$('#user_profile_state').val(), $('#user_profile_country').val(), $('#user_profile_twitter').val());

	// update cache
	UserProfile.user['fname']  = $('#user_profile_fname').val();
	UserProfile.user['lname']  = $('#user_profile_lname').val();
	UserProfile.user['email']  = $('#user_profile_email').val();
	UserProfile.user['password']  = $('#user_profile_password').val();
	UserProfile.user['organization']  = $('#user_profile_org').val();
	UserProfile.user['city']  = $('#user_profile_city').val();
	UserProfile.user['state']  = $('#user_profile_state').val();
	UserProfile.user['country']  = $('#user_profile_country').val();
	UserProfile.user['twitter']  = $('#user_profile_twitter').val();
	
	// update cloud
	var obj = {};
	obj.un=UserProfile.user['email'];
	obj.pw=UserProfile.user['password'];
	obj.firstname=UserProfile.user['fname'];
	obj.lastname=UserProfile.user['lname'];
	obj.organization=UserProfile.user['organization'];
	obj.city=UserProfile.user['city'];
	obj.state=UserProfile.user['state'];
	obj.country=UserProfile.user['country'];
	obj.twitter=UserProfile.user['twitter'];
	TiDev.invokeCloudService(UserProfile.updateURL,obj,'POST');
	
	// update Android SDK
	Projects.updateAndroidSDKLoc($('#user_android_sdk').val());
};

//
// set form data
//
UserProfile.setFormData = function()
{
	$('#user_profile_fname').val(UserProfile.user['fname']);
	$('#user_profile_lname').val(UserProfile.user['lname']);
	$('#user_profile_email').val(UserProfile.user['email']); 
	$('#user_profile_password').val(UserProfile.user['password']); 
	$('#user_profile_org').val(UserProfile.user['organization']);
	$('#user_profile_city').val(UserProfile.user['city']);
	$('#user_profile_state').val(UserProfile.user['state']); 
	$('#user_profile_country').val(UserProfile.user['country']);
	$('#user_profile_twitter').val(UserProfile.user['twitter']);
	$('#user_profile_password').get(0).type = 'password';
	$('#save_profile_button').removeClass('disabled');
	$('#user_android_sdk').val(Projects.getAndroidSDKLoc());
};

UserProfile.setupView = function()
{
	TiUI.setBackgroundColor('#1c1c1c');
	TiDev.contentLeft.hide();
	TiDev.contentLeftHideButton.hide();
	TiDev.contentLeftShowButton.hide();		
	TiUI.GreyButton({id:'save_profile_button'});

	// save profile
	$('#save_profile_button').click(function()
	{
		if ($(this).hasClass('disabled')) return;
		
		var androidSDK = $('#user_android_sdk').val();
		if (androidSDK.length > 0 && !TiDev.validateAndroidSDK(androidSDK)) return;
		
		var message = 'Your changes have been saved';
		var delay = 2000;
		
		try
		{
			if (UserProfile.user['email'])
			{
				UserProfile.updateRow();
			}
			else
			{
				UserProfile.insertRow();
			}
		}
		catch (e)
		{
			delay = 5000;
			message = 'Unexpected error, message ' + e;
		}
		
		TiDev.setConsoleMessage(message,delay);

		var copy = {};
		for (var p in UserProfile.user)
		{
			if (p != 'password' && p != 'email')
			{
				copy[p]=UserProfile.user[p];
			}
		}
		TiDev.track('profile-edit',copy);
	});
	
	// set form data
	if (UserProfile.user['email'])
	{
		UserProfile.setFormData();
	}
	// look it up
	else
	{
		var dbrow;
		try
		{
			dbrow = TiDev.db.execute('SELECT * from USERS');
		}
		catch(e)
		{
			TiDev.db.execute('CREATE TABLE USERS (fname TEXT, lname TEXT, email TEXT, password TEXT, organization TEXT, city TEXT, state TEXT, country TEXT, twitter TEXT, twitter_password TEXT)');
		}
		while (dbrow.isValidRow())
		{
			UserProfile.user['fname']  = dbrow.fieldByName('fname');
			UserProfile.user['lname']  = dbrow.fieldByName('lname');
			UserProfile.user['email']  = dbrow.fieldByName('email');
			UserProfile.user['password']  = dbrow.fieldByName('password');
			UserProfile.user['organization']  = dbrow.fieldByName('organization');
			UserProfile.user['city']  = dbrow.fieldByName('city');
			UserProfile.user['state']  = dbrow.fieldByName('state');
			UserProfile.user['country']  = dbrow.fieldByName('country');
			UserProfile.user['twitter']  = dbrow.fieldByName('twitter');
			UserProfile.setFormData();
			break;
		}
	}

	// if no data setup form stuff
	if (!UserProfile.user['email'] || UserProfile.user['email'] == '')
	{
		$('#user_profile_email').val(UserProfile.defaultValues.email);
		$('#user_profile_email').addClass('hinttext')
		$('#user_profile_email').focus(function()
		{
			if ($(this).val() == UserProfile.defaultValues.email)
			{
				$(this).val('');
				$(this).removeClass('hinttext')
			}
		});
	}

	if (!UserProfile.user['password'] || UserProfile.user['password'] == '')
	{
		$('#user_profile_password').val(UserProfile.defaultValues.password);
		$('#user_profile_password').addClass('hinttext')
		$('#user_profile_password').focus(function()
		{
			if ($(this).val() == UserProfile.defaultValues.password)
			{
				$(this).val('');
				$(this).removeClass('hinttext')
			}
		});
	}

	// password toggle
	$('#password_toggle').click(function()
	{
		if ($('#user_profile_password').get(0).type == 'password')
		{
			$('#user_profile_password').get(0).type = 'text';
		}
		else
		{
			$('#user_profile_password').get(0).type = 'password';
		}
	})
	
	// validation
	TiUI.validator('user_profile',function(valid)
	{
		if (valid) 
			$('#save_profile_button').removeClass('disabled');
		else
			$('#save_profile_button').addClass('disabled');
	});

	$('#android_sdk_icon_button').click(function()
	{
		var props = {multiple:false,directories:true,files:false};
		Titanium.UI.currentWindow.openFolderChooserDialog(function(f)
		{
			if (f.length)
			{
				var sdkDir = f[0];
				TiDev.validateAndroidSDK(sdkDir, function()
				{
					$('#user_android_sdk').val(sdkDir);
				});
			}
		},
		props);						
	});

};

// setup event handler
UserProfile.eventHandler = function(event)
{
	if (event == 'focus')
	{
		UserProfile.setupView();
	}
	else if (event == 'load')
	{
		UserProfile.setupView();
	}
	
};

// register module
TiDev.registerModule({
	name:'user_profile',
	displayName: 'Edit Profile',
	perspectives:['profile'],
	html:'user_profile.html',
	active:true,
	idx:0,
	callback:UserProfile.eventHandler
});