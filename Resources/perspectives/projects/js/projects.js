Projects = {};

// project cache
Projects.projectList = [];

// current project
Projects.selectedProjectIdx = -1;

// current tab
Projects.selectedTab = -1;

// do we need to select a tab programtically
Projects.selectInitialTab = false;

// state var for project db
Projects.dbInitialized = false;

// default runtime version
Projects.currentRuntimeVersion = Titanium.version;

// used to increment new project IDs
Projects.highestId = 0;

// state var used to determine modules are loaded
Projects.modulesLoaded = false;

// track whether mobile SDKs are present
Projects.hasIPhone = false;
Projects.hasAndroid = false;
Projects.hasIPad = false;
Projects.hasRunMobileCheck = false;
Projects.hasRunIPadCheck = false;

// URLs
Projects.ssoLoginURL = "sso-login";
Projects.ssoRegisterURL = "sso-register";
Projects.ssoResetPasswordURL = "sso-reset-password";

// TOKENS
Projects.userSID = null;
Projects.userToken = null;
Projects.userUID = null;
Projects.userUIDT = null;

// var to determine if login should be shown
Projects.needLogin = false;

// facebook session stuff
Projects.facebookAppId = "9494e611f2a93b8d7bfcdfa8cefdaf9f";
Projects.facebookSession = null;


//
//  Set the active project index and update the database.
//
Projects.setActiveProject = function(newIndex)
{

	Projects.selectedProjectIdx = newIndex;
	//$MQ('l:tidev.projects.row_selected',{'project_id':newIndex,'activeTab':TiDev.activeSubtab.name});
	
	try
	{
		TiDev.db.execute('update PROJECT_VIEW set ACTIVE = ?', newIndex);
	}
	catch (e)
	{
		// The database probably doesn't exist. Try this again. A failure here
		// is a real failure and should throw an exception.
		TiDev.db.execute('CREATE TABLE IF NOT EXISTS PROJECT_VIEW (ACTIVE INT)');
		TiDev.db.execute('insert into PROJECT_VIEW VALUES(0)');
		TiDev.db.execute('update PROJECT_VIEW set ACTIVE = ?', newIndex);
	}
}

//
//  Return current project object
//
Projects.getProject = function()
{
	if (Projects.selectedProjectIdx == -1  && Projects.projectList.length > 0)
	{
		Projects.setActiveProject(Projects.projectList[0].id);
	}
	for (var i=0;i<Projects.projectList.length;i++)
	{
		if (Projects.projectList[i].id == Projects.selectedProjectIdx)
		{
			return Projects.projectList[i];
		}
	}
	return Projects.projectList[Projects.projectList.length -1];
};

//
// Once modules are loaded, we may select the initial tab 
//
$MQL('l:tidev.modules.loaded',function()
{
	Projects.modulesLoaded = true;
	if (Projects.selectInitialTab == true)
	{
		TiDev.subtabChange(0);
	}
});

//
// create user record
//
Projects.createUser = function()
{
	// get data from form
	var email = $('#login_email').val();
	var password = $('#login_password').val();
	var lname = $('#login_lname').val();
	var fname = $('#login_fname').val();
	var org = $('#login_org').val();
	var city = $('#login_city').val();
	var state = $('#login_state').val();
	var country = $('#login_country').val();
	var twitter = $('#login_twitter').val();
	
	// register failure callback
	function registerFailed(resp)
	{
		$('#progress_message').css('display','none');
		$('#error_message').html('request timed out.  make sure you are online.');
		$('#error_message_area').css('display','inline');	
	}
	
	// register success callback
	function registerOK(resp)
	{
		// insert user record
		if (resp.success == true)
		{
			// record token vars
			Projects.userSID = resp.sid;
			Projects.userToken = resp.token;
			Projects.userUID = resp.uid;
			Projects.userUIDT = resp.uidt;
			// create user record
			try
			{
				TiDev.db.execute('INSERT INTO USERS (fname, lname, email, password, organization, city, state, country, twitter) VALUES (?,?,?,?,?,?,?,?,?)',
					fname,lname,email,password,org,city,state,country,twitter);
			}
			// create table and try again
			catch (e)
			{
				TiDev.db.execute('CREATE TABLE USERS (fname TEXT, lname TEXT, email TEXT, password TEXT, organization TEXT, city TEXT, state TEXT, country TEXT, twitter TEXT, twitter_password TEXT)');
				TiDev.db.execute('INSERT INTO USERS (fname, lname, email, password, organization, city, state, country, twitter) VALUES (?,?,?,?,?,?,?,?,?)',
					fname,lname,email,password,org,city,state,country,twitter);		
			}

			Projects.needLogin = false;
			Projects.setupPostLoginView();					

			// show authenticated indicator
			$('#tiui_shield_off').css('display','none');
			$('#tiui_shield_on').css('display','inline');
			
			// if the user is connecting via Facebook
			if (Projects.facebookSession && Projects.facebookSession.isLoggedIn())
			{
				Projects.facebookSession.publishFeed('134879989930');
			}
			// open post registration page
			Titanium.Desktop.openURL('http://api.appcelerator.net/p/pages/install-success/developer/'+ encodeURIComponent(Titanium.Platform.id));
		}
		// show error
		else
		{
			$('#progress_message').css('display','none');
			$('#error_message').html('sign up error: ' + resp.reason);
			$('#error_message_area').css('display','inline');	
		}
		
	};
	// create remote reigstration
	TiDev.invokeCloudService(
		Projects.ssoRegisterURL,
		{
			un:email,
			pw:password,
			firstname:fname,
			lastname:lname,
			organization:org,
			city:city,
			state:state,
			country:country,
			twitter:twitter	
		},
		'POST',
		registerOK,
		registerFailed
	);
	
};

//
// setup post login/signup page
//
Projects.setupPostLoginView = function()
{
	// reset UI components
	$('body').css('opacity','0')
	$('#tiui_header').css('display','block');
	$('#tiui_content_body').css('top','74px');
	Titanium.UI.currentWindow.setHeight(620);
	Titanium.UI.currentWindow.setResizable(true);
	$('body').animate({'opacity':'1.0'},1400);

	// setup UI view
	Projects.setupView();
	
};

//
// setup Login/Signup
//
Projects.showLogin = function()
{
	Projects.needLogin = true;
	
	TiUI.setBackgroundColor('#575757');
	
	// format window
	$('#tiui_header').css('display','none');
	TiDev.contentLeftShowButton.hide();
	TiDev.contentLeftHideButton.hide();
	TiDev.contentLeft.hide();
	TiDev.subtabs.hide();
	$('#tiui_content_body').css('top','0px');
	
	// load signup/login page
	var file = Titanium.Filesystem.getFile(Titanium.App.appURLToPath('perspectives/projects/login_signup.html'));
	$('#tiui_content_right').get(0).innerHTML = file.read();
	
	// setup buttons
	TiUI.GreyButton({id:'login_button'});
	TiUI.GreyButton({id:'signup_button'});
	TiUI.GreyButton({id:'reset_password_button'});
	
	// connect with facebook
	$("#fbconnect_button").click(function()
	{
		Titanium.Facebook.createSession(Projects.facebookAppId,function(fb)
		{
				fb.login(function(ok,url,vars,email,pass)
				{
					if (ok)
					{
						Projects.facebookSession = fb;
						
						fb.query("select first_name,last_name,pic,current_location,work_history from user where uid = " + fb.getUID(),function(re)
						{
							var r = re[0];
							var current_location = r.current_location;
							var city = current_location ? current_location.city : null;
							var state = current_location ? current_location.state : null;
							var country = current_location ? current_location.country : null;
							var first_name = r.first_name;
							var last_name = r.last_name;
							var pic = r.pic;
							var organization = null;
							if (r.work_history && r.work_history.length > 0)
							{
								organization = r.work_history[0].company_name;
							}
							$('#login_email').val(fb.getUserEmail()).removeClass('tiui_invalid_field').css({
								'background-color':'transparent',
								'border':'none',
								'color':'#fff'
							});
							$('#login_fname').val(first_name).removeClass('tiui_invalid_field');
							$('#login_lname').val(last_name).removeClass('tiui_invalid_field');
							$('#login_password').val(pass).removeClass('tiui_invalid_field');
							$('#login_repeat_password').val(pass).removeClass('tiui_invalid_field');
							$('#repeat_password_field').css('display','none');
							$('#password_field').css('display','none');
							$('#login_org').val(organization);
							$('#login_city').val(city);
							$('#login_state').val(state);
							$('#login_country').val(country);
							
							$("#column_banner").css("display","none");
							$("#column_facebook").css("display","block");
							$('#profile_pic').attr("src",pic);
							$('#fb_name').html("Welcome, "+first_name+"!");
							$("#fbconnect_button").css("display","none");
							$('#login_tab').css('display','none');
							$('#register_tab').html('Connect to Facebook').css('width','200px');
							$('#profile_divider').css('display','none');
							$('#profile_description').css('display','none');
							$('#profile_fb_description').css("display","block");
							$('#signup_button').html('Complete Connection');
							$('#signup_button').removeClass('disabled').get(0).focus();
						});
					}
				});
		});
	});
	
	// setup checkbox for reset on/off
	$('#reset_pw_checkbox').click(function()
	{
		if($(this).val()=='on')
		{
			$('#password_field').css('display','none');
			$('#login_button').css('display','none');
			$('#reset_password_button').css('display','inline');
		}
		else
		{
			$('#reset_password_button').css('display','none');
			$('#login_button').css('display','inline');
			$('#password_field').css('display','block');			
		}
	});
	
	// reset password handler
	$('#reset_password_button').click(function()
	{
		// show progress message
		$('#error_message_area').css('display','none');
		$('#progress_message').css('display','inline');

		var email = $('#login_email').val();

		// reset password success callback
		function resetOK(resp)
		{
			$('#progress_message').css('display','none');
			if (resp.success == true)
			{
				$('#success_message').css('display','inline');
				setTimeout(function()
				{
					$('#success_message').css('display','none');
				},3000)
			}
			else
			{
				$('#error_message').html('reset error: ' + resp.reason);
				$('#error_message_area').css('display','inline');
			}			
		};
		
		// reset password failed callback
		function resetFailed(resp)
		{
			$('#progress_message').css('display','none');
			$('#error_message').html('request timed out.  make sure you are online.');
			$('#error_message_area').css('display','inline');			
		};
		
		// reset password
		TiDev.invokeCloudService(Projects.ssoResetPasswordURL,{un:email},'POST',resetOK, resetFailed);
	});
	
	// login button handler
	$('#login_button').click(function()
	{
		if ($('#login_button').hasClass('disabled'))return;

		// show progress message
		$('#error_message_area').css('display','none');
		$('#progress_message').css('display','inline');

		var email = $('#login_email').val();
		var password = $('#login_password').val();

		// login success callback
		function loginOK(resp)
		{
			if (resp.success == true)
			{
				Projects.userSID = resp.sid;
				Projects.userToken = resp.token;
				Projects.userUID = resp.uid;
				Projects.userUIDT = resp.uidt;
				TiDev.isCommunity = resp.community;
				TiDev.setAdURLs();
				TiDev.setPermissions(resp.permissions);				
				
				// we have NO local data - so create record
				if (Projects.needLogin == true)
				{
					try
					{
						TiDev.db.execute('INSERT INTO USERS (email, password) VALUES (?,?)',email,password);
					}
					// create table and try again
					catch (e)
					{
						TiDev.db.execute('CREATE TABLE USERS (fname TEXT, lname TEXT, email TEXT, password TEXT, organization TEXT, city TEXT, state TEXT, country TEXT, twitter TEXT, twitter_password TEXT)');
						TiDev.db.execute('INSERT INTO USERS (email, password) VALUES (?,?)',email,password);
					}					
					Projects.needLogin = false;
				}
				
				// run through ui setup again
				Projects.setupPostLoginView();	

				// show authenticated indicator
				$('#tiui_shield_off').css('display','none');
				$('#tiui_shield_on').css('display','inline');
			}
			else
			{
				$('#progress_message').css('display','none');
				$('#error_message').html('login error: ' + resp.reason)
				$('#error_message_area').css('display','inline');			
			}
		};
		
		// login failed callback
		function loginFailed(resp)
		{
			$('#progress_message').css('display','none');
			$('#error_message').html('request timed out.  make sure you are online.');
			$('#error_message_area').css('display','inline');	
		};
		
		// login
		TiDev.invokeCloudService(Projects.ssoLoginURL,{un:email,pw:password},'POST',loginOK, loginFailed);
	});

	// signup button handler
	$('#signup_button').click(function()
	{
		if ($('#signup_button').hasClass('disabled'))return;
		
		$('#error_message_area').css('display','none');
		$('#progress_message').css('display','inline');
		var password = $('#login_password').val();
		var passwordRepeat = $('#login_repeat_password').val();
		
		if (password != passwordRepeat)
		{
			$('#progress_message').css('display','none');
			$('#error_message').html('password and re-type password must match.')
			$('#error_message_area').css('display','inline');
			return;
		}
		if (password.length < 4)
		{
			$('#progress_message').css('display','none');
			$('#error_message').html('password must be at least 4 characters.')
			$('#error_message_area').css('display','inline');
			return;
		}

		if (Projects.facebookSession && Projects.facebookSession.isLoggedIn())
		{
			Projects.facebookSession.publishFeed('134879989930',null,'Lorem ipsum dolor sit amet, consectetur adipisicing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.');
		}

		//insert a new record
		Projects.createUser(); 
	});
	
	// handler to show registration
	$('#register_tab').click(function()
	{
		$('#login_button').hide();
		$('#reset_checkbox_container').hide();
		$('#reset_password_button').hide();
		$('#registration_fields').fadeIn();
		$('#login_tab').removeClass('active');
		$('#register_tab').addClass('active');
		$('#password_field').css('display','block');
//		$('#fbconnect_login_button_container').hide();
		$('#login_email').get(0).focus();
	});
	// handler to show login
	$('#login_tab').click(function()
	{
		$('#registration_fields').hide();
		$('#login_button').show();
//		$('#fbconnect_login_button_container').show();
		$('#reset_checkbox_container').show();
		$('#login_tab').addClass('active');
		$('#register_tab').removeClass('active');
		$('#reset_pw_checkbox').removeAttr('checked');
		$('#login_email').get(0).focus();
	});
	
	// connect the fb connect login button
	$('#fbconnect_login_button').click(function()
	{
		Titanium.Facebook.createSession(Projects.facebookAppId,function(fb)
		{
				fb.login(function(ok,url,vars,email,pass)
				{
					if (ok)
					{
						//TODO: do the login here
						alert("You should be logged in here");
					}
				});
		});
	});
	
	// validation for login
	TiUI.validator('login',function(valid)
	{
		if (valid) 
			$('#login_button').removeClass('disabled');
		else
			$('#login_button').addClass('disabled');
	});
	
	// validation for signup
	TiUI.validator('signup',function(valid)
	{
		if (valid) 
			$('#signup_button').removeClass('disabled');
		else
			$('#signup_button').addClass('disabled');
	});

	// validation for reset password
	TiUI.validator('reset',function(valid)
	{
		if (valid) 
			$('#reset_password_button').removeClass('disabled');
		else
			$('#reset_password_button').addClass('disabled');
	});
	
	Titanium.UI.currentWindow.setResizable(false);
	Titanium.UI.currentWindow.setHeight(580);
	
};

//
//  Initialize UI
//
Projects.setupView = function(options)
{
	TiUI.setBackgroundColor('#1c1c1c');
	
	// see if user has registered
 	try
	{
		var email = null;
		var password = null;	
		var dbrow = TiDev.db.execute('SELECT email, password from USERS');
		while(dbrow.isValidRow())
		{
			email = dbrow.fieldByName('email');
			password = dbrow.fieldByName('password');
			break;
		}
		// if no data, show Login
		if (email == null)
		{
			Projects.showLogin();
			return;
		}
		// 
		// we have a user record, do auto-login to get tokens
		//
		if (Projects.userSID == null && Titanium.Network.online==true)
		{
			// login success callback
			function loginOK (resp)
			{
				// good
				if (resp.success==true)
				{
					Projects.userSID = resp.sid;
					Projects.userToken = resp.token;
					Projects.userUID = resp.uid;
					Projects.userUIDT = resp.uidt;
					TiDev.isCommunity = resp.community;
					TiDev.setAdURLs();
					TiDev.setPermissions(resp.permissions);
					
					TiDev.attributes = resp.attributes;
					UserProfile.updateUser(email,TiDev.attributes);				
					
					// show authenticated indicator
					$('#tiui_shield_off').css('display','none');
					$('#tiui_shield_on').css('display','inline');

					Projects.showAuthenticatedView();
				}
				// WTF?
				else
				{
					// we are in a weird state, drop user table
					TiDev.db.execute('DELETE FROM USERS');
					Projects.showLogin();
				}
			};
			
			// login failed callback
			function loginFailed(resp)
			{
				$('#tiui_shield_on').css('display','none');
				$('#tiui_shield_off').css('display','inline');
				if (resp.offline == true)
				{
					Projects.showAuthenticatedView();
				}
			};
			// login
			TiDev.invokeCloudService(Projects.ssoLoginURL,{un:email,pw:password,mid:Titanium.platform.id},'POST',loginOK, loginFailed);
		}
		else
		{
			Projects.showAuthenticatedView(options);
		}
	}
	catch (e)
	{
		Projects.showLogin(options);
	}
};


//
//  Show authenticated view
//
Projects.showAuthenticatedView = function(options)
{
	
	// set default UI state
	TiDev.contentLeftShowButton.hide();
	TiDev.contentLeftHideButton.show();
	TiDev.contentLeft.show();
	TiDev.subtabs.hide();
	
	// initialize project db stuff
	if (Projects.dbInitialized==false)
	{
		Projects.initDB();
	}
	
	// show no project view
	if (Projects.projectList.length == 0)
	{
		TiDev.contentLeft.setContent('<div class="parent">PROJECTS</div><div class="child"><div>No Projects</div></div>');
		TiDev.subtabChange(0);

	}
	
	// show project view
	else
	{
		// set base UI stuff
		$('#no_project_view').css('display','none');
		TiDev.subtabs.show();			

		// remember the last project we selected
		try
		{
			var rs = TiDev.db.execute("select ACTIVE from PROJECT_VIEW");
			while (rs.isValidRow())
			{
				Projects.selectedProjectIdx = rs.field(0);
				break;
			}
			rs.close();
		}
		catch(e)
		{
			TiDev.db.execute('CREATE TABLE IF NOT EXISTS PROJECT_VIEW (ACTIVE INT)');
			TiDev.db.execute('insert into PROJECT_VIEW VALUES(0)');
		}
		// if we have projects and no tab is selected, select edit
		if (options && options.showEditProjectTab == true)
		{
			TiDev.subtabChange(1);
		}
		else
		{
			if (TiDev.subtabs.activeIndex == -1)
			{
				if (Projects.modulesLoaded == true)
				{
					TiDev.subtabChange(0);
				}
				else
				{
					Projects.selectInitialTab = true;
				}
			}
		}
		// paint tree
		var html = '<div class="parent">PROJECTS</div>';
		for (var i=0;i<Projects.projectList.length;i++)
		{
			var classes = 'child ';
			
			if (Projects.selectedProjectIdx == Projects.projectList[i].id)
			{
				classes += 'active';
			}

			html += '<div class="'+classes+'" project_id="'+Projects.projectList[i].id+'">';
			html += '<div>' + Projects.projectList[i].name + '</div></div>';
		}
		
		// fire selected message
		if (Projects.selectedProjectIdx >= 0)
		{
			$MQ('l:tidev.projects.row_selected',{'project_id':Projects.selectedProjectIdx,'activeTab':TiDev.activeSubtab.name});			
		}
		
		// set content
		TiDev.contentLeft.setContent(html);
		
		// create click handler
		$('.#tiui_content_left .child').click(function()
		{
			TiDev.subtabs.show();		
			$('#tiui_content_left .child').removeClass('active');
			$(this).addClass('active');

			var newProjectIndex = $(this).attr('project_id');
			Projects.setActiveProject(newProjectIndex);

			$MQ('l:tidev.projects.row_selected',{'project_id':newProjectIndex,'activeTab':TiDev.activeSubtab.name});
		});
		
	}
	
};

//
// Handle UI events
//
Projects.eventHandler = function(event)
{
	if (event == 'load')
	{
		Projects.setupView();
	}
	else if (event == 'focus')
	{
		Projects.setupView();
	}
}

//
//  Init DB and load projects
//
Projects.initDB = function()
{	
	Projects.dbInitialized = true;
	var migrations = null;
	var projects = null;
	var runMigration = true;
	var createMigrationTbl = false;
	var createProjectTbl = false;
	
	try
	{
		// iphone attributes
		try
		{
			var s = TiDev.db.execute('SELECT * FROM IPHONE_ATTRIBUTES');
		}
		catch (e)
		{
			TiDev.db.execute('CREATE TABLE IPHONE_ATTRIBUTES (ID INTEGER, NAME TEXT, VALUE TEXT)');
		}
		// get migrations
		try
		{
			migrations = TiDev.db.execute("SELECT * FROM MIGRATIONS");
		}
		catch(e)
		{
			createMigrationTbl=true;
		}
		
		// get projects
		try
		{
			projects = TiDev.db.execute("SELECT * FROM PROJECTS");
		}
		catch(e)
		{
			createProjectTbl = true;
		}

		// see if project modules exists
		try
		{
			TiDev.db.execute('SELECT * FROM PROJECTMODULES');
		}
		catch(e)
		{
			TiDev.db.execute('CREATE TABLE PROJECTMODULES (guid TEXT, name TEXT, version TEXT)');
		}
		
		// see if project platforms exists
		try
		{
			TiDev.db.execute('SELECT * FROM PROJECTPLATFORMS');
		}
		catch(e)
		{
			TiDev.db.execute('CREATE TABLE PROJECTPLATFORMS (guid TEXT, platform TEXT)');
		}
		
		// if no migration table, create
		if (createMigrationTbl)
		{
			TiDev.db.execute('CREATE TABLE MIGRATIONS (name TEXT, completed INTEGER)');
		}
		else
		{
			while (migrations.isValidRow())
			{
				if (migrations.fieldByName('name') == 'BETA'  && migrations.fieldByName('completed') == 1)
				{
					runMigration = false;
					break;
				}
				migrations.next();
			}
		}
		
		// create projects table
		if (createProjectTbl)
		{
			runMigration = false;
			
			// create new project table
			TiDev.db.execute("CREATE TABLE PROJECTS (id INTEGER UNIQUE, type TEXT, guid TEXT, runtime TEXT, description TEXT, timestamp REAL, name TEXT, directory TEXT, appid TEXT, publisher TEXT, url TEXT, image TEXT, version TEXT, copyright TEXT)");	    

			// no need to ever run migration - this is a new install
			TiDev.db.execute('INSERT INTO MIGRATIONS (name, completed) values ("BETA",1)');			

		}
		else
		{
			Projects.projectList = [];
			while (projects.isValidRow())
			{
				// delete project if its directory is not valid
				var dir = Titanium.Filesystem.getFile(projects.fieldByName('directory'));
				if (!dir.exists())
				{
					TiDev.db.execute('DELETE FROM PROJECTS where id = ?',projects.fieldByName('id'));
				}
				//otherwise, record it
				else
				{
					// get modules
					var moduleRows = TiDev.db.execute('SELECT * FROM PROJECTMODULES WHERE guid = ?',projects.fieldByName('guid'));
					var languageModules = {};
					while(moduleRows.isValidRow())
					{
						if (moduleRows.fieldByName('name') == 'ruby')
						{
							languageModules['ruby'] = 'on';
						}
						if (moduleRows.fieldByName('name') == 'python')
						{
							languageModules['python'] = 'on';
						}
						if (moduleRows.fieldByName('name') == 'php')
						{
							languageModules['php'] = 'on';
						}

						moduleRows.next();
					}
					moduleRows.close();
					
					// get platforms
					var platformRows = TiDev.db.execute('SELECT * FROM PROJECTPLATFORMS WHERE guid = ?',projects.fieldByName('guid'));
					var platforms = {};
					var requiresPlatformUpdate = true;
					while (platformRows.isValidRow()) 
					{
						requiresPlatformUpdate = false;
						platforms[platformRows.fieldByName('platform')] = true;
						platformRows.next();
					}
					platformRows.close();
					
					// We're working with a TiDev project that predates 1.3.0... and need
					// to both get and update the platform information.  In this case
					// SDK detection is costly so we hack it and look for the old-school
					// build dirs.
					if (requiresPlatformUpdate)
					{
						var dir = projects.fieldByName('directory');
						platforms['ios'] = Titanium.Filesystem.getFile(dir,'build','iphone').exists();
						platforms['android'] = Titanium.Filesystem.getFile(dir,'build','android').exists();
					}
					
					// format date 
					var date = new Date();
					date.setTime(projects.fieldByName('timestamp'));
					var strDate = (date.getMonth()+1)+"/"+date.getDate()+"/"+date.getFullYear();
					
					Projects.projectList.push({
						id:projects.fieldByName('id'),
						guid:projects.fieldByName('guid'),
						runtime:projects.fieldByName('runtime'),
						type:projects.fieldByName('type'),
						description:projects.fieldByName('description'),
						date:strDate,
						name:projects.fieldByName('name'),
						dir:projects.fieldByName('directory'),
						appid:projects.fieldByName('appid'),
						publisher:projects.fieldByName('publisher'),
						url:projects.fieldByName('url'),
						image:projects.fieldByName('image'),
						copyright:projects.fieldByName('copyright'),
						version:projects.fieldByName('version'),
						'languageModules':languageModules,
						platforms:platforms
					});

					// Perform platform update if necessary
					if (requiresPlatformUpdate)
					{
						for (var platform in platforms)
						{
							if (platforms[platform]) 
							{
								TiDev.db.execute("INSERT INTO PROJECTPLATFORMS (guid, platform) VALUES (?,?)", projects.fieldByName('guid'), platform);
							}
						}
					}
					
					// record highest id - used when creating new records
					if (projects.fieldByName('id') > Projects.highestId)
					{
						Projects.highestId = projects.fieldByName('id');
					}
				}			
				projects.next();
			}
		}
		
		// close DB resources
		if (migrations != null)
		{
			migrations.close();
		}
		if (projects != null)
		{
			projects.close();
		}
		
		// run migration
		if (runMigration == true)
		{
			Projects.runMigrations()
		}
	}
	catch (e)
	{
		alert('Unexpected SQL error on project initialization, message: ' + e);
		return;
	}
	
	
};

//
// Run Data Migration
//
Projects.runMigrations = function()
{
	TiDev.db.execute('DROP TABLE PROJECTS');
	TiDev.db.execute("CREATE TABLE PROJECTS (id INTEGER UNIQUE, type TEXT, guid TEXT, runtime TEXT, description TEXT, timestamp REAL, name TEXT, directory TEXT, appid TEXT, publisher TEXT, url TEXT, image TEXT, version TEXT, copyright TEXT)");	    
	
	for (var i=0;i<Projects.projectList.length;i++)
	{
		var p = Projects.projectList[i];
		var guid = (p.guid == null)? Titanium.Platform.createUUID() :p.guid;
		var type = (p.type == null)?'desktop':p.type
		var version = "1.0";
		var copyright = new Date().getFullYear() + " by " + p['publisher'];
		var runtime = Projects.currentRuntimeVersion;;
		try
		{
			TiDev.db.execute('INSERT INTO PROJECTS (id, type, guid, runtime, description, timestamp, name, directory, appid, publisher, url, image, version, copyright) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
				p['id'],type,guid,runtime,p['description'],p['date'],p['name'],p['location'],p['appid'],p['publisher'],p['url'],p['image'],version,copyright);
		} 
		catch (e)
		{
			alert('Unexpected SQL error on running migration, message: ' + e);
			return;
		}
	}
	TiDev.db.execute('INSERT INTO MIGRATIONS (name, completed) values ("BETA",1)');

}

//
// Import project click handler
//
Projects.handleImportClick = function()
{
	var props = {multiple:false,directories:true,files:false};
	Titanium.UI.currentWindow.openFolderChooserDialog(function(f)
	{
		if (f.length)
		{
			Projects.importProject(f[0]);
		}
	},
	props);
	
	
}
//
// Import click listener - for main import
//
$('.import_project_button').click(function()
{
	Projects.handleImportClick();
});

//
// Update Android SDK location
//
Projects.updateAndroidSDKLoc = function(loc)
{
	try
	{
		var insert = true;
		var rows = TiDev.db.execute('SELECT * FROM SDKLOCATION');
		while (rows.isValidRow())
		{
			TiDev.db.execute('UPDATE SDKLOCATION SET LOCATION = ?',loc.trim());
			insert = false;
			break;
		}
		if (insert==true)
		{
			TiDev.db.execute('INSERT INTO SDKLOCATION VALUES(?)',loc.trim());
		}
	}
	catch(e)
	{
		TiDev.db.execute('CREATE TABLE SDKLOCATION (LOCATION TEXT)');
		TiDev.db.execute('INSERT INTO SDKLOCATION VALUES(?)',loc.trim());
	}
};
//
// Get Android SDK location
//
Projects.getAndroidSDKLoc = function()
{
	try
	{
		var location = TiDev.db.execute('SELECT LOCATION FROM SDKLOCATION');
		while(location.isValidRow())
		{
			var androidSDK = location.fieldByName('LOCATION');
			if (androidSDK.trim().length == 0) {
				return null;
			}

			TiDev.androidSDKDir = androidSDK;
			return TiDev.androidSDKDir;
		}
	}
	catch(e)
	{
		TiDev.db.execute('CREATE TABLE SDKLOCATION (LOCATION TEXT)');
	}
	return null;
};
//
// Project click handler
//
Projects.handleNewProjectClick = function()
{
	TiDev.contentLeftShowButton.hide();
	TiDev.contentLeftHideButton.hide();
	TiDev.contentLeft.hide();
	TiUI.setBackgroundColor('#1c1c1c');
	TiDev.subtabs.hide();
	$('#tiui_content_submenu').hide();
	$('#tiui_content_body').css('top','53px');
	
	var file = Titanium.Filesystem.getFile(Titanium.App.appURLToPath('perspectives/projects/new_project.html'));
	$('#tiui_content_right').get(0).innerHTML = file.read();

	// setup ads
	$('#new_project_ads').html(TiDev.newProjectAdContent);

	// see if we have a mobile sdk
	var sdks = Titanium.Project.getMobileSDKVersions();
	
	// reload perms
	TiDev.permissions = TiDev.getPermissions();
	
	if (TiDev.permissions['mobilesdk'] !='enabled' || sdks.length == 0)
	{
		$('#new_project_type').attr('disabled','true');
		$('#new_project_type').css('backgroundColor','#5a5a5a');
		$('#new_project_type').css('color','#fff');
	}
	else
	{
		$('#new_project_type').removeAttr('disabled');
		$('#new_project_type').css('backgroundColor','#fff');
		$('#new_project_type').css('color','#000');
		
	}
	$('#new_project_frame').fadeIn();
	
	// initialize mobile settings
	if (Projects.hasIPhone == true)
	{
		$('#iphone_sdk_true').css('display','block');
		$('#iphone_sdk_false').css('display','none');
	}
	if (Projects.hasAndroid == true)
	{
		$('#android_sdk_true').css('display','block');
		$('#android_sdk_false').css('display','none');
	}
	
	// handle hint text for appid
	$('#new_project_appid').focus(function()
	{
		if ($(this).val()=='com.companyname.appname')
		{
			$(this).val('');
			$(this).removeClass('hinttext');
		}
	});
	
	// set library dropdown
	//$('#new_project_js').html('<option value="jquery">JQuery</option><option value="entourage">Entourage</option><option value="mootools">Mootools</option><option value="prototype">Prototype</option><option value="scriptaculous">Scriptaculous</option><option value="dojo">Dojo</option><option value="yui">Yahoo YUI</option><option value="swf">SWF Object</option>');

	// Determine available project types
	var projectTypes = '<option value="desktop" selected>Desktop</option><option value="mobile">Mobile</option>';
	if (Titanium.platform == 'osx')
	{
		projectTypes += '<option value="ipad">iPad</option><option value="universal">Universal iOS</option>';
	}
	$('#new_project_type').html(projectTypes);

	// reset dropdown
	$('#new_project_type').val('desktop');

	// project type listener
	$('#new_project_type').change(function()
	{
		var sdkVers = Titanium.Project.getMobileSDKVersions();
		var sdk = Titanium.Project.getMobileSDKVersions(sdkVers[0]);

		// set scripts for current sdk version
		iPhonePrereqPath = Titanium.Filesystem.getFile(sdk.getPath(),'iphone/prereq.py');
		androidPrereqPath = Titanium.Filesystem.getFile(sdk.getPath(),'android/prereq.py');
		
		if ($(this).val()=='ipad' || $(this).val()=='universal')
		{	
			$('#mobile_platforms').css('display','none');
			$('#desktop_language_modules').css('display','none');
			if (Projects.hasIPad ==false)
			{
				TiDev.setConsoleMessage('Checking for iPad prerequisites...');
				
				// run ipad prereq check
				var iPadCheck = TiDev.launchPython([Titanium.Filesystem.getFile(iPhonePrereqPath).toString(),'project']);
				iPadCheck.setOnRead(function(event)
				{
					var d = event.data.toString();
					var data = swiss.evalJSON(d);
					if (data.ipad)
					{
						Projects.hasIPad = true;
					}
					TiDev.resetConsole();
					if (!Projects.hasIPad)
					{
						alert('The iPad requires version 3.2 of the iOS SDK.  Please install to continue');
						$('#new_project_type').val('desktop')
					}
				});
				iPadCheck.launch();
			}
		}
		else if ($(this).val() == 'mobile')
		{
			$('#mobile_platforms').css('display','block');
			$('#desktop_language_modules').css('display','none');

			if (Projects.hasRunMobileCheck == false)
			{
				Projects.hasRunMobileCheck = true;
				
				if (Titanium.platform != 'osx')
				{
					TiDev.setConsoleMessage('Checking for Android prerequisites...');
					checkAndroid();
				}
				else
				{
					TiDev.setConsoleMessage('Checking for iOS prerequisites...');
					
					// run iphone prereq check
					var iPhoneCheck = TiDev.launchPython([Titanium.Filesystem.getFile(iPhonePrereqPath).toString(),'project']);
					iPhoneCheck.setOnExit(function(event)
					{
						var e = iPhoneCheck.getExitCode();
						// success
						if (e == 0)
						{
							// create artifical delay so user can see message
							setTimeout(function()
							{
								$('#iphone_sdk_true').css('display','block');
								$('#iphone_sdk_false').css('display','none');
								
								Projects.hasIPhone = true;
								TiDev.setConsoleMessage('Success!  Now checking for Android...');
								checkAndroid();
							},1000);

						}
						// no XCode
						else if (e == 1)
						{
							alert('XCode is not installed.  It is required for iOS.');
							TiDev.setConsoleMessage('Checking for Android prerequisites...');
							checkAndroid();
						}
						// no 3.0 SDK
						// Handled for Universal by iPad iOS version check
						else if (e == 2)
						{
							alert('You must have iOS SDK installed.  We cannot find it.');
							TiDev.setConsoleMessage('Checking for Android prerequisites...');
							checkAndroid();
							
						}
					});
					iPhoneCheck.launch();
				}
				
				// helper function for checking android prereqs
				function checkAndroid()
				{
					if (Projects.getAndroidSDKLoc() != null)
					{
						TiDev.setConsoleMessage('Success!  Android SDK was found.');
						$('#android_sdk_true').css('display','block');
						$('#android_sdk_false').css('display','none');							
						Projects.hasAndroid = true;
						
						setTimeout(function()
						{
							TiDev.resetConsole();
						},2000);
						return;
					
					}
					
					var androidCheck = TiDev.launchPython([Titanium.Filesystem.getFile(androidPrereqPath).toString(),'project']);
					var dir = null;
					androidCheck.setOnRead(function(event)
					{
						dir = event.data.toString().trim();
					});
					androidCheck.setOnExit(function(event)
					{
						var e = androidCheck.getExitCode();
						if (e == 0)
						{
							TiDev.androidSDKDir = dir;
							Projects.updateAndroidSDKLoc(TiDev.androidSDKDir);

							Projects.hasAndroid = true;
							$('#android_sdk_true').css('display','block');
							$('#android_sdk_false').css('display','none');							
							setTimeout(function()
							{
								TiDev.setConsoleMessage('Success!  Android SDK was found.');
								setTimeout(function()
								{
									TiDev.resetConsole();
								},2000);
							},1000);
						}
						else if (e ==1)
						{
							TiDev.resetConsole();
							alert('Java not found.  Java is required for Android')
						}
						else if (e == 2)
						{
							TiDev.resetConsole();
							if (confirm('Android SDK 1.6 was not found.  If it is installed, can you provide the location?'))
							{
								var props = {multiple:false,directories:true,files:false};
								Titanium.UI.currentWindow.openFolderChooserDialog(function(f)
								{
									if (f.length)
									{
										// set file and revalidate
										var sdkDir = f[0];
										TiDev.validateAndroidSDK(sdkDir, function()
										{
											TiDev.androidSDKDir = sdkDir;
											
											Projects.updateAndroidSDKLoc(TiDev.androidSDKDir);
											
											Projects.hasAndroid = true;
											$('#android_sdk_true').css('display','block');
											$('#android_sdk_false').css('display','none');
										});
									}
								},
								props);						
							}
						}
					});
					androidCheck.launch();
				};
			}
		}
		else 
		{
			$('#mobile_platforms').css('display','none');
			$('#desktop_language_modules').css('display','block');
			// set library dropdown
			//$('#new_project_js').html('<option value="jquery">JQuery</option><option value="entourage">Entourage</option><option value="mootools">Mootools</option><option value="prototype">Prototype</option><option value="scriptaculous">Scriptaculous</option><option value="dojo">Dojo</option><option value="yui">Yahoo YUI</option><option value="swf">SWF Object</option>');
			
		}
	})
	// create main buttons
	TiUI.GreyButton({id:'create_project_button'});
	TiUI.GreyButton({id:'cancel_project_button'});


	// create handler
	$('#create_project_button').click(function()
	{
		if($(this).hasClass('disabled')) return;
		if ($('#new_project_type').val() == 'mobile')
		{
			if (Projects.hasIPhone == false && Projects.hasAndroid == false)
			{
				alert('Mobile SDKs not installed.  Please download and install the iOS SDK 3.0 and/or the Android SDK.');
				return;
			}
		}
		var options = {};
		options.name = $('#new_project_name').val();
		options.runtime = $('#new_project_runtime').val();
		options.dir = $('#new_project_location').val();
		//options.jsLibs = $('#new_project_js').val();
		options.type = $('#new_project_type').val();
		options.url = $('#new_project_url').val();
		options.appid = $('#new_project_appid').val();
		options.iphone = ($('#iphone_sdk_true').css('display') != 'none')?true:false;
		options.android = ($('#android_sdk_true').css('display') != 'none')?true:false;
		options.ruby = ($('#language_ruby_checked').css('display') != 'none')?'on':'';
		options.python = ($('#language_python_checked').css('display') != 'none')?'on':'';
		options.php = ($('#language_php_checked').css('display') != 'none')?'on':'';

		if (options.type=='universal')
		{
			// Perform a Titanium SDK check - we require at minimum 1.6.0
			var versions = options.runtime.split('.');
			if (parseInt(versions[0]) < 1 || 
				(parseInt(versions[0]) == 1 && parseInt(versions[1]) < 6))
			{
				alert('iOS universal development is only supported in Titanium SDK 1.6.0 and later');
				return;
			}
		}

		Projects.createProject(options,true);
	});

	$('#cancel_project_button').click(function()
	{
		TiDev.goBack();
	});
	
	// dir listing handler
	$('#new_project_location_icon').click(function()
	{
		var props = {multiple:false,directories:true,files:false};
		Titanium.UI.currentWindow.openFolderChooserDialog(function(f)
		{
			if (f.length)
			{
				// set file and revalidate
				$('#new_project_location').val(f[0]);
				validator();
			}
		},
		props);
		
	});

	//
	// checkbox listeners
	//
	$('#language_ruby').click(function()
	{
		if ($('#language_ruby_checked').css('display') != 'none')
		{
			$('#language_ruby_checked').css('display','none');
			$('#language_ruby_unchecked').css('display','block');
		}
		else
		{
			$('#language_ruby_checked').css('display','block');
			$('#language_ruby_unchecked').css('display','none');
		}	
	});
	$('#language_python').click(function()
	{
		if ($('#language_python_checked').css('display') != 'none')
		{
			$('#language_python_checked').css('display','none');
			$('#language_python_unchecked').css('display','block');
		}
		else
		{
			$('#language_python_checked').css('display','block');
			$('#language_python_unchecked').css('display','none');
		}	
	});
	$('#language_php').click(function()
	{
		if ($('#language_php_checked').css('display') != 'none')
		{
			$('#language_php_checked').css('display','none');
			$('#language_php_unchecked').css('display','block');
		}
		else
		{
			$('#language_php_checked').css('display','block');
			$('#language_php_unchecked').css('display','none');
		}	
	});

	// form validation
	var validator = TiUI.validator('new_project',function(valid)
	{
		if (valid) 
			$('#create_project_button').removeClass('disabled');
		else
			$('#create_project_button').addClass('disabled');
	});
	
	
	// populate select
	var versions = Titanium.Project.getSDKVersions();
	var html = '';
	for (var i=0;i<versions.length;i++)
	{
		html += '<option value="'+ versions[i] +'">'+ versions[i] +'</option>';
	}
	$('#new_project_runtime').html(html);

	// toggle language modules based on project type
	$('#new_project_type').bind('change',function()
	{

		if ($(this).val() == 'mobile' || $(this).val() == 'ipad' || $(this).val() == 'universal')
		{
			$('#language_modules').addClass('disabled');
			$('#new_project_ruby').attr('disabled','true');
			$('#new_project_python').attr('disabled','true');
			$('#new_project_php').attr('disabled','true');
			
			// populate select
			var versions = Titanium.Project.getMobileSDKVersions();
			var html = '';
			for (var i=0;i<versions.length;i++)
			{
				html += '<option value="'+ versions[i] +'">'+ versions[i] +'</option>';
			}
			$('#new_project_runtime').html(html);
			
		}
		else
		{
			// populate select
			var versions = Titanium.Project.getSDKVersions();
			var html = '';
			for (var i=0;i<versions.length;i++)
			{
				html += '<option value="'+ versions[i] +'">'+ versions[i] +'</option>';
			}
			$('#new_project_runtime').html(html);
			
			$('#language_modules').removeClass('disabled');
			$('#new_project_ruby').removeAttr('disabled');
			$('#new_project_python').removeAttr('disabled');
			$('#new_project_php').removeAttr('disabled');

		}
	})
	
};

//
// New project click listener
//
$('#new_project_button').click(function()
{
	Projects.handleNewProjectClick();
});

//
// Import a project
//
Projects.importProject = function(f)
{
	var dir = f;
	var file = TFS.getFile(dir, 'manifest');
	if (file.exists() == false)
	{
		alert('This directory does not contain valid Titanium project.  Please try again.');
		return;
	}
	
	// create object for DB record
	var options = {};
	options.dir = dir;
	
	// read manifest values to create new db record
	var stream = TFS.getFileStream(dir, 'manifest');
	stream.open();
	for (var line = stream.readLine(); line != null; line = stream.readLine())
	{
		var entry = Titanium.Project.parseEntry(line.toString());
		if (entry == null)
			continue;

		if (entry.key.indexOf('appname') != -1)
		{
			options.name = entry.value;
		}
		if (entry.key.indexOf('version') != -1)
		{
			options.version = entry.value;
		}
		else if (entry.key.indexOf('publisher') != -1)
		{
			options.publisher = entry.value;
		}
		else if (entry.key.indexOf('url') != -1)
		{
			options.url = entry.value;
		}
		else if (entry.key.indexOf('image') != -1)
		{
			options.image = entry.value;
		}
		else if (entry.key.indexOf('appid') != -1)
		{
			options.appid = entry.value;
		}
		else if (entry.key.indexOf('guid') != -1)
		{
			options.guid = entry.value;
		}
		else if (entry.key.indexOf('desc') != -1) // will pick up 'desc' or 'description'
		{
			options.description = entry.value;
		}
		else if (entry.key.indexOf('type') != -1)
		{
			options.type = entry.value;
		}
		if (entry.key.indexOf('runtime') != -1)
		{
			options.runtime = entry.value;
		}
		else if (entry.key.indexOf('ruby') != -1)
		{
			options.ruby = 'on';
		}
		else if (entry.key.indexOf('python') != -1)
		{
			options.python = 'on';
		}
		else if (entry.key.indexOf('php') != -1)
		{
			options.php = 'on';
		}
	}
	stream.close();

	// Settings in tiapp.xml always override the manifest.
	var xmlDocument = (new DOMParser()).parseFromString(
		TFS.getFile(dir, 'tiapp.xml').read(), "text/xml");
	var get_element_innards = function(tagName, property)
	{
		var elems = xmlDocument.getElementsByTagName(tagName);
		if (elems.length > 0)
			options[property] = elems[0].textContent;
	}
	get_element_innards('version', 'version');
	get_element_innards('description', 'description');
	get_element_innards('publisher', 'publisher');
	get_element_innards('url', 'url');
	get_element_innards('icon', 'image');
	get_element_innards('copyright', 'copyright');

	// if not type - default to desktop
	if (!options.type)
	{
		options.type = 'desktop';
	}

	// ensure sdk verison is available
	var versions = null;
	if (options.type == 'desktop')
	{
		var versions = Titanium.Project.getSDKVersions();
		if (versions.length == 0)
		{
			alert('You are importing a desktop project, but no Desktop SDK versions exist on your system');
			return;
		}
		completeImport();
	}
	else 
	{
		var versions = Titanium.Project.getMobileSDKVersions();
		if (versions.length == 0)
		{
			alert('You are importing a '+options.type + ' project, but no Mobile SDK versions exist on your system');
			return;
		}
		// TODO: Allow import support as a universal
		// see if ipad is an option
		if (Titanium.platform == 'osx' && Projects.hasIPad==false)
		{
			var sdkVers = Titanium.Project.getMobileSDKVersions();
			var sdk = Titanium.Project.getMobileSDKVersions(sdkVers[0]);
			iPhonePrereqPath = Titanium.Filesystem.getFile(sdk.getPath(),'iphone/prereq.py');

			var iPadCheck = TiDev.launchPython([Titanium.Filesystem.getFile(iPhonePrereqPath).toString(),'project']);
			iPadCheck.setOnRead(function(event)
			{
				var d = event.data.toString();
				var data = swiss.evalJSON(d);
				if (data.ipad)
				{
					Projects.hasIPad = true;
					completeImport();
				}
				else
				{
					completeImport();
				}
			});
			iPadCheck.launch();
		}
		else
		{
			completeImport();
		}
	}
	//
	//  complete import process - function is needed because of async call above to check for ipad
	//
	function completeImport()
	{
		// give user option to import ipad project
		if (options.type == 'mobile')
		{
			if (Projects.hasIPad)
			{
				var answer = confirm('You are importing a mobile project.  Click OK to continue or click Cancel to import this as an iPad project.');
				if (answer==false)
				{
					options.type = 'ipad';
				}
			}
		}

		// Preserve the original runtime version if possible. If not, use the first available runtime.
		if (options.runtime === undefined || versions.indexOf(options.runtime) == -1)
			options.runtime = versions[0];

		Projects.createProject(options);
		Titanium.Analytics.featureEvent('project.import',options);
		TiDev.setConsoleMessage('Your project has been imported', 2000);
		
	}

};

//
// Create a project record in the DB and update array cache
//
Projects.createProject = function(options, createProjectFiles)
{
	// create project object
	var date = new Date();
	options.date = (date.getMonth()+1)+"/"+date.getDate()+"/"+date.getFullYear();

	options.id = options.appid;
	if (options.url === undefined)
		options.url = '';
	if (options.publisher === undefined)
		options.publisher = Titanium.Platform.username;
	if (options.image === undefined)
		options.image = 'default_app_logo.png';
	if (options.guid === undefined)
		options.guid = Titanium.Platform.createUUID();
	if (options.description === undefined)
		options.description = 'No description provided';
	if (options.version === undefined)
		options.version = '1.0';
	if (options.copyright === undefined)
		options.copyright = date.getFullYear() + ' by ' + options.publisher;

	// normal names 
	var normalizedName = options.name.replace(/[^a-zA-Z0-9]/g,'_').toLowerCase();
	normalizedName = normalizedName.replace(/ /g,'_').toLowerCase();
	var normalizedPublisher = options.publisher.replace(/[^a-zA-Z0-9]/g,'_').toLowerCase();
	normalizedPublisher = normalizedPublisher.replace(/ /g,'_').toLowerCase();
	
	var record = {
		name: options.name,
		dir: options.dir,
		id: ++Projects.highestId,
		appid: options.id,
		date: options.date,
		publisher:options.publisher,
		url:options.url,
		image:options.image,
		guid:options.guid,
		description:options.description,
		runtime: options.runtime,
		type:(options.type)?options.type:'desktop',
		version:options.version,
		copyright:options.copyright,
		'languageModules':{'ruby':options.ruby,'python':options.python, 'php':options.php},
		platforms:{'ios':options.iphone, 'android':options.android}
	};

	// only record event if we are creating project files
	if (createProjectFiles == true)
	{
		Titanium.Analytics.featureEvent('project.create',record);
	}

	// create project directories
	if (createProjectFiles == true)
	{
		var result = {};
		result.success = false;
		if (options.type == 'desktop')
		{
		 	result = Titanium.Project.create(options);
			if (result.success==true)
			{
				result = createDBRecord();
				writeAppTextFiles();
			}
			setMessage();
		}
		else
		{
			// see if directory already exists
			if (Titanium.Filesystem.getFile(options.dir,options.name).exists() == true)
			{
				result.message = 'Directory already exists: ' +Titanium.Filesystem.getFile(options.dir,options.name).toString();
				setMessage();
			}
			else
			{
				var args = [options.name , options.id, options.dir];
				if (options.iphone == true || options.type == 'ipad' || options.type == 'universal')
				{
					args.push('iphone');
				}
				if (options.android==true)
				{
					args.push('android');
					args.push(TiDev.androidSDKDir.trim());
				}
				TiDev.setConsoleMessage('Creating '+options.type+' project: ' + options.name);

				// determine path to project create script
				var sdk = Titanium.Project.getMobileSDKVersions(options.runtime);
				var path = Titanium.Filesystem.getFile(sdk.getPath(),'project.py');
				args.unshift(Titanium.Filesystem.getFile(path).toString());
				var	x = TiDev.launchPython(args);
				var errorMessage = "";
				x.stderr.addEventListener(Titanium.READ, function(event)
				{
					errorMessage += event.data.toString();
				});
				x.setOnExit(function(event)
				{
					var e = x.getExitCode();
					if (e!=0)
					{
						result.message = errorMessage;
						setMessage();
					}
					else
					{
						result['success'] = true;
						options.image = 'appicon.png';
						record.image = 'appicon.png';
						Titanium.Project.createMobileResources(options);
						setMessage();
						createDBRecord();
						writeAppTextFiles();
						
					}
				});
				x.launch();
			}
		}
		
	}
	else
	{
		// create db record
		result = createDBRecord();
		setMessage();
	}
	
	function writeAppTextFiles()
	{
		var license = Titanium.Filesystem.getFile(options.dir,options.name,'LICENSE.txt');
		var changelog = Titanium.Filesystem.getFile(options.dir,options.name,'CHANGELOG.txt');
		license.write('Place your license text here.  This file will be incorporated with your app at package time.');
		changelog.write('Place your change log text here.  This file will be incorporated with your app at package time.');
		
	};
	function setMessage()
	{
		var message = 'Project "'+record.name+'" was created.';
		var delay = 2000;
		if (result.success == false)
		{
			message = 'Project creation error: ' + result.message;
			delay = 5000;
		}
		// show message
		TiDev.setConsoleMessage(message,delay);

	};
	
	function createDBRecord()
	{
		// add name to dir if new project
		if (createProjectFiles == true)
		{
			record['dir'] = Titanium.Filesystem.getFile(options.dir,options.name).toString();
		}

		var result = {};
		// create project record
		try
		{
			// insert record and push into cache
		    TiDev.db.execute("INSERT INTO PROJECTS (id, type, runtime, guid, description,timestamp, name, directory, appid, publisher, url, image,version,copyright) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,?,?)", record.id,record.type,record.runtime,record.guid,record.description,date.getTime(),record.name,record.dir,record.appid,record.publisher,record.url,record.image,record.version,record.copyright);	
			Projects.projectList.push(record);
			if (record['languageModules'].ruby == 'on')
			{
			    TiDev.db.execute("INSERT INTO PROJECTMODULES (guid, name, version) VALUES (?, ?, ?)", record.guid, 'ruby',Projects.currentRuntimeVersion);	
			}
			if (record['languageModules'].python == 'on')
			{
			    TiDev.db.execute("INSERT INTO PROJECTMODULES (guid, name, version) VALUES (?, ?, ?)", record.guid, 'python',Projects.currentRuntimeVersion);	
			}
			if (record['languageModules'].php == 'on')
			{
			    TiDev.db.execute("INSERT INTO PROJECTMODULES (guid, name, version) VALUES (?, ?, ?)", record.guid, 'php',Projects.currentRuntimeVersion);	
			}
			
			for (var platform in record.platforms)
			{
				if (record.platforms.platform) 
				{
					TiDev.db.execute("INSERT INTO PROJECTPLATFORMS (guid, platform) VALUES (?,?)", record.guid, platform);
				}
			}

			result =  {success:true};
		}
		catch (e)
		{
			result =  {success:false,message:'Unexpected SQL error inserting project, message ' + e};
		}

		Projects.setActiveProject(record.id);
		if (TiDev.activePerspective.name != 'projects')
		{
			TiDev.perspectiveChange(0);
		}
		Projects.setupView({showEditProjectTab:true});
		return result;

	};

}

//
// Register perspective
//
TiDev.registerPerspective({
	name:'projects',
	active:true,
	image:'perspectives/projects/images/projects.png',
	activeImage:'perspectives/projects/images/projects_active.png',
	imageTitle:'Projects',
	html:'projects.html',
	callback:Projects.eventHandler,
	idx:0,
	views:[]
});


