Sandbox = {};
Sandbox.lastTempDir = null;
Sandbox.code = [];
Sandbox.refreshing = -1;
Sandbox.initialCodeMessage = 'Welcome to the Titanium Desktop API Sandbox.\n\nSelect a code snippet.\n\nOR\n\nJust start typing (and optionally select a Javascript library to the left), then click \'Launch\' to run the code.';
Sandbox.url = "snippet-list";

//
// Add api to text editor
//
Sandbox.setAPI = function()
{
	var selector = $('#api_selector').get(0);
	var selectedIndex = selector.selectedIndex;
	if (Sandbox.refreshing!=-1 && selectedIndex == 0) 
	{
		selector.selectedIndex = Sandbox.refreshing;
		Sandbox.refreshing=-1;
		return;
	}
	if (selectedIndex > 0)
	{
		var entry = Sandbox.code[selectedIndex-1];
		var code = $.gsub(entry.code,"\\\\n","\n");
		$('#text_editor').val(code);
	}
	else
	{
		$('#text_editor').val(Sandbox.initialCodeMessage);
	}
};

//
// Refresh list of APIs
//
Sandbox.refreshAPI = function()
{
	TiDev.invokeCloudService(Sandbox.url,{},'GET',function(results)
	{
		fetched = true;
		Sandbox.code = results;
		var data = [];
		data.unshift({
			title:'select code snippet...',
			code:null
		});
		var html = '<option value="">select code snippet...</option>';
		
		for (var c=0;c<results.length;c++)
		{
			html += '<option>' + results[c].title + '</option>';
		}
		$('#api_selector').html(html)
	});
};

Sandbox.setupView = function()
{
	TiUI.setBackgroundColor('#1c1c1c');
	TiDev.contentLeft.hide();
	TiDev.contentLeftHideButton.hide();
	TiDev.contentLeftShowButton.hide();	

	// setup editor
	$('#text_editor').markItUp(mySettings);

	$('#text_editor').val(Sandbox.initialCodeMessage);

	// setup editor click handler
	$('#text_editor').click(function()
	{
		var editor = $('#text_editor');
		if (editor.val()==Sandbox.initialCodeMessage)
		{
			editor.val('');
		}
	});

	// reload API list handler
	$('#api_refresh').click(function()
	{
		Sandbox.refreshing=$('#api_selector').get(0).selectedIndex;
		refreshAPIList();
	});

	// handle change event for code select
	$('#api_selector').change(function()
	{
		Sandbox.setAPI();
	});
	
	// buttons
	TiUI.GreyButton({id:'launch_sandbox_button'});
	TiUI.GreyButton({id:'clear_sandbox_button'});

	// button handlers
	$('#clear_sandbox_button').click(function()
	{
		$('#text_editor').val('');
	});
	$('#launch_sandbox_button').click(function()
	{
		var rootdir = Titanium.Filesystem.createTempDirectory().toString();

		var options = {};
		options.name = "sandbox";
		options.runtime = Projects.currentRuntimeVersion;
		options.dir = rootdir;
		options.id = 'com.titaniumapp.sandbox';
		options.publisher = 'Appcelerator';
		options.jsLibs = $('#sandbox_js').val();
		options.type = 'desktop'
		options['languageModules'] = {'ruby':'on','python':'on','php':'on'};
		options.image = 'default_app_logo.png'
		options.url = "http://www.appcelerator.com";
		options.html = $('#text_editor').val();
		options.desc = 'Sandbox app';
		options.guid = Titanium.Platform.createUUID();
		
		var outdir = TFS.getFile(rootdir,options.name);

		// remove last sandbox temp dir
		if (Sandbox.lastTempDir != null)
		{
			Sandbox.lastTempDir.deleteDirectory(true);
		}
		// record this temp dir for deletion next time
		Sandbox.lastTempDir = outdir;

		// create project
		Titanium.Project.create(options);
		
		// add name to root dir for launch
		options.dir = rootdir + '/' + options.name;
		//set desktop packaging path
		var sdk = Titanium.Project.getSDKVersions(Projects.currentRuntimeVersion);
		PackageProject.desktopPackage = Titanium.Filesystem.getFile(sdk.getPath(),'tibuild.py');
		var dest = Titanium.Filesystem.getFile(options.dir,'dist',Titanium.platform);
		
		if (dest.exists()==false)
		{
			dest.createDirectory(true);
		}
		var sdkDir = Titanium.Filesystem.getFile(sdk.getPath());
		var basePath = Titanium.Filesystem.getFile(sdkDir,".." + Titanium.Filesystem.getSeparator(),".." + Titanium.Filesystem.getSeparator(),".." + Titanium.Filesystem.getSeparator());
		var assets = Titanium.Filesystem.getFile(sdk.getPath());
		var appdir = Titanium.Filesystem.getFile(options.dir);
	
		// write out new manifest based on current modules
		Titanium.Project.writeManifest(options);
	
		var p = null;
		// launch desktop app
		p = TiDev.launchPython([PackageProject.desktopPackage.toString(), "-d",dest.toString(),"-t", "network","-a",assets.toString(),appdir.toString(),"-n","-r","-v","-s",basePath.toString()]);
		p.launch();
	 	TiDev.track('sandbox-launch',options);
	 });
	
	// load APIs
	Sandbox.refreshAPI();
		
};

// setup event handler
Sandbox.eventHandler = function(event)
{
	if (event == 'focus')
	{
		Sandbox.setupView();
	}
	else if (event == 'load')
	{
		Sandbox.setupView();
	}
};

//register module
TiDev.registerModule({
	name:'sandbox',
	displayName: 'Sandbox',
	perspectives:['community'],
	html:'sandbox.html',
	idx:1,
	callback:Sandbox.eventHandler
});
