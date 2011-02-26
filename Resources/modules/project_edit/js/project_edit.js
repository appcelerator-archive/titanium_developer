EditProject = {};
EditProject.currentProject = null;

//
// Row selection listener
//
$MQL('l:tidev.projects.row_selected',function(msg)
{
	if (msg.payload.activeTab == 'project_edit')
	{
		EditProject.setFormData(Projects.getProject())
	}
});



//
// Set project form data
//
EditProject.setFormData = function(p)
{
	EditProject.currentProject = p;

	// set default UI state
	TiUI.setBackgroundColor('#1c1c1c');
	TiDev.contentLeft.show();
	TiDev.contentLeftHideButton.show();
	TiDev.contentLeftShowButton.hide();	
	TiUI.GreyButton({id:'project_edit_save_button'});
	TiUI.GreyButton({id:'project_edit_delete_button'});
	

	$('#edit_project_date').html(p.date);

	var displayDir = p.dir;
	if (p.dir.length > 50)
	{
		displayDir = p.dir.substring(0,50) + '...';
	}
	
	
	function openProjectFolder()
	{
		switch(Titanium.platform)
		{
			case 'osx':
			{
				Titanium.Process.createProcess(["/usr/bin/open",p.dir]).launch();
				break;
			}
			case 'win32':
			{
				Titanium.Process.createProcess(["C:\\Windows\\explorer.exe","/e,"+Titanium.Filesystem.getFile(p.dir).toString()]).launch();
				break;
			}
			case 'linux':
			{
				Titanium.Process.createProcess(["xdg-open",p.dir]).launch();
				break;
			}
		}
	};
	$("#edit_project_dir").click(openProjectFolder);
	$("#edit_project_open").click(openProjectFolder);

	$('#edit_project_dir').html(displayDir);
	$('#edit_project_name').html(p.name);
	$('#edit_project_desc').val(p.description);
	$('#edit_project_publisher').val(p.publisher);	
	$('#edit_project_url').val(p.url);
	$('#edit_project_icon').val(p.image);
	$('#edit_project_appid').val(p.appid);
	$('#edit_project_version').val(p.version);
	$('#edit_project_copyright').val(p.copyright);

	if (p.type == 'mobile' || p.type== 'ipad' || p.type == 'universal')
	{
		$('#edit_project_type').html('(Mobile Application)');
		$('#language_modules').css('display','none');

		if (p.type=='universal')
		{
			$('#mobile_icon').css('display','none');
			$('#ipad_icon').css('display','none');
			$('#ios_icon').css('display','inline');
		}
		else if (p.type=='ipad')
		{
			$('#mobile_icon').css('display','none');
			$('#ipad_icon').css('display','inline');
			$('#ios_icon').css('display','none');
		}
		else
		{
			$('#mobile_icon').css('display','inline');
			$('#ipad_icon').css('display','none');
			$('#ios_icon').css('display','none');
		}
		$('#desktop_icon').css('display','none');
		$('#project_edit_lang_modules').css('display','none');
		$('#project_edit .frame').css('height','320px');

		// populate select
		var versions = Titanium.Project.getMobileSDKVersions();
		var html = '';
		for (var i=0;i<versions.length;i++)
		{
			html += '<option value="'+ versions[i] +'">'+ versions[i] +'</option>';
		}
		$('#edit_project_runtime').html(html);

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
		$('#edit_project_runtime').html(html);
		
		$('#project_edit .frame').css('height','350px');

		$('#project_edit_lang_modules').css('display','block');
		
		$('#mobile_icon').css('display','none');
		$('#desktop_icon').css('display','inline');
		$('#ipad_icon').css('display','none');
		$('#ios_icon').css('display','none');

		$('#edit_project_type').html('(Desktop Application)');

		// set language module values
		$('#language_modules').css('display','block')

		// check for ruby
		if (p['languageModules'].ruby == 'on')
		{
			$('#language_ruby_checked').css('display','block');
			$('#language_ruby_unchecked').css('display','none');
		}
		else
		{
			$('#language_ruby_checked').css('display','none');
			$('#language_ruby_unchecked').css('display','block');
		}
		// check for python
		if (p['languageModules'].python == 'on')
		{
			$('#language_python_checked').css('display','block');
			$('#language_python_unchecked').css('display','none');
		}
		else
		{
			$('#language_python_checked').css('display','none')
			$('#language_python_unchecked').css('display','block');
		}
		// check for python
		if (p['languageModules'].php == 'on')
		{
			$('#language_php_checked').css('display','block');
			$('#language_php_unchecked').css('display','none');
		}
		else
		{
			$('#language_php_checked').css('display','none')
			$('#language_php_unchecked').css('display','block');
		}

	}
	$('#edit_project_runtime').val(p.runtime);
	
	TiUI.validator('edit_project',function(valid)
	{
		if (valid) 
			$('#project_edit_save_button').removeClass('disabled');
		else
			$('#project_edit_save_button').addClass('disabled');
	});
};

//
// Setup UI view
//
EditProject.setupView = function()
{
	// set form fields
	EditProject.setFormData(Projects.getProject())


	$('#project_edit_delete_button').click(function()
	{
		if (confirm('Are you sure you want to delete this project?')==true)
		{
			try
			{
				Titanium.Analytics.featureEvent('project.delete',{guid:EditProject.currentProject.guid,name:EditProject.currentProject.name,appid:EditProject.currentProject.appid});
				
				// remove db data
				TiDev.db.execute('DELETE FROM PROJECTS WHERE ID = ?', EditProject.currentProject.id);
				TiDev.db.execute('DELETE FROM PROJECTMODULES WHERE GUID = ?', EditProject.currentProject.guid);

				// remove directory and contents only after super double check. I call this the 'bess ho' alert.  -JGH
				var f = Titanium.Filesystem.getFile(EditProject.currentProject.dir);
				if (confirm("WARNING: Delete the directory and it's contents:\n\n" + f.nativePath() + "\n\nor leave the directory contents intact?\n\nClick 'OK' to delete or 'Cancel' to leave directory intact."))
				{
					f.deleteDirectory(true);
				}

				// remove from cache
				var a = [];
				for (var i=0;i<Projects.projectList.length;i++)
				{
					if (Projects.projectList[i].id != EditProject.currentProject.id)
					{
						// set new selected index to first row
						if (i==0)
						{
							Projects.setActiveProject(Projects.projectList[i].id);
						}
						a.push(Projects.projectList[i]);
					}
				}
				Projects.projectList = a;

				// resetView
				TiDev.subtabs.activeIndex = 1;
				Projects.setupView();

				Links.deletePackagesForGUID(EditProject.currentProject.guid);
				TiDev.db.execute('DELETE FROM PROJECTDOWNLOADS WHERE GUID = ?', EditProject.currentProject.guid);
				TiDev.db.execute('DELETE FROM IPHONE_ATTRIBUTES WHERE ID = ?', EditProject.currentProject.id);
			}
			catch(e)
			{
				// do nothing
			}
			
		}
	});

	//
	// Icon button listener
	//
	$('#edit_project_icon_button').click(function()
	{
		var props = {multiple:false,directories:false,files:true,types:['gif','png','jpg']};
		Titanium.UI.openFileChooserDialog(function(f)
		{
			if (f.length)
			{
				$('#edit_project_icon').val(f[0]);
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

		
	//
	// Save changes to project
	//
	$('#project_edit_save_button').click(function()
	{
		if ($(this).hasClass('disabled')) return;
		
		// save project and update cache
		var name = EditProject.currentProject.name = $('#edit_project_name').html();
		var desc = EditProject.currentProject.description =$('#edit_project_desc').val();
		var pub = EditProject.currentProject.publisher = $('#edit_project_publisher').val();	
		var url = EditProject.currentProject.url = $('#edit_project_url').val();
		var imageName = EditProject.currentProject.image = $('#edit_project_icon').val();
		var runtime = EditProject.currentProject.runtime = $('#edit_project_runtime').val();
		var appid = EditProject.currentProject.appid = $('#edit_project_appid').val();
		var version = EditProject.currentProject.version = $('#edit_project_version').val();
		var copyright = EditProject.currentProject.copyright = $('#edit_project_copyright').val();

		if (EditProject.currentProject.type=='universal')
		{
			// Perform a Titanium SDK check - we require at minimum 1.6.0
			var versions = EditProject.currentProject.runtime.split('.');
			if (parseInt(versions[0]) < 1 || 
				(parseInt(versions[0]) == 1 && parseInt(versions[1]) < 6))
			{
				alert('iOS universal development is only supported in Titanium SDK 1.6.0 and later');
				return;
			}
		}

		var rubyOn = ($('#language_ruby_checked').css('display') != 'none')?'on':'';
		var pythonOn = ($('#language_python_checked').css('display') != 'none')?'on':'';
		var phpOn = ($('#language_php_checked').css('display') != 'none')?'on':'';
		
		var message = 'Your changes have been saved';
		var delay = 2000;

		// update tiapp.xml
		var tiapp = Titanium.Filesystem.getFileStream(EditProject.currentProject.dir,'tiapp.xml');
		tiapp.open(Titanium.Filesystem.MODE_READ);
		
		var line = tiapp.readLine(true);
		var newXML = line + '\n';
		var inWindowSection = false;
		while (true)
		{
			line = tiapp.readLine();
			if(line==null)
			{
				tiapp.close();
				break;
			} 
			if (line.indexOf('<window') != -1)
			{ 
				inWindowSection = true;
			}

			if (line.indexOf('<version') != -1)
			{
				newXML += '<version>' + version + '</version>\n';
				continue;
			}
			if (line.indexOf('<name') != -1)
			{
				newXML += '<name>' + name + '</name>\n';
				continue;
			}
			if (line.indexOf('<description') != -1)
			{
				newXML += '<description>' + desc + '</description>\n';
				continue;
			}

			if (line.indexOf('<id') != -1 && inWindowSection == false)
			{
				newXML += '<id>' + appid + '</id>\n';
				continue;
			}
			if (line.indexOf('publisher') != -1)
			{
				newXML += '<publisher>' + pub + '</publisher>\n';
				continue;
			}
			// do special handling for image
			if (line.indexOf('<icon') != -1  && inWindowSection == false)
			{
				// look for image in two places - either full path or in resources dir
				var image = TFS.getFile(imageName);
				var resources = TFS.getFile(EditProject.currentProject.dir,'Resources');
				var iconFound = image.exists();
				if (!iconFound)
				{
					image = TFS.getFile(resources,imageName);
					iconFound = image.exists();
				}
				// if it's a mobile type of project, could be that icon file is in platform-specific Resources
				// folder.
				if (!iconFound)
				{
					var platforms = ['android', 'iphone'];
					for (var index in platforms) {
						image = TFS.getFile(resources, platforms[index], imageName);
						if (image.exists()) {
							iconFound = true;
							break;
						}
					}
				}
				// use default if not exists
				if (!iconFound)
				{
					var path = Titanium.App.appURLToPath('app://images');
					image = TFS.getFile(path,'default_app_logo.png')
					var image_dest = TFS.getFile(resources,image.name());
					if (!image_dest.exists()) {
						image.copy(image_dest);
					}
				}
				imageName = image.name();			
				newXML += '<icon>' + imageName + '</icon>\n';
				continue;
			}
			if (line.indexOf('<url') != -1 && inWindowSection == false)
			{
				newXML += '<url>' + url + '</url>\n';
				continue;
			}
			if (line.indexOf('<copyright') != -1)
			{
				newXML += '<copyright>' + copyright + '</copyright>\n';
				continue;
			}
			//Titanium.API.info('ADDING LINE ' + line)
			newXML += line + '\n';
		}
		tiapp.open(Titanium.Filesystem.MODE_WRITE);
		tiapp.write(newXML);
		tiapp.close();

		// update database
		try
		{
			// insert record and push into cache
		    TiDev.db.execute("UPDATE PROJECTS SET runtime = ?, description = ?, name = ?,  publisher = ?, url = ?, image = ?, appid = ?, copyright = ?, version = ? WHERE id = ?", 
					runtime, desc, name, pub, url, imageName, appid, copyright, version, EditProject.currentProject.id );	
		}
		catch (e)
		{
			message = 'Unexpected error, message ' + e;
			delay = 5000;
		}
		
		Titanium.Analytics.settingsEvent('project.edit',{name:name,desc:desc,publisher:pub,url:url,image:imageName,sdk:runtime,appid:appid,version:version,copyright:copyright,ruby:rubyOn,python:pythonOn});

		// update cache
		for (var i=0;i<Projects.projectList.length;i++)
		{
			if (Projects.projectList[i].id == EditProject.currentProject.id)
			{
				Projects.projectList[i].name = name;
				Projects.projectList[i].descrption = desc;
				Projects.projectList[i].publisher = pub;
				Projects.projectList[i].url = url;
				Projects.projectList[i].image = imageName;
				Projects.projectList[i].runtime = runtime;
				Projects.projectList[i].appid = appid;
				Projects.projectList[i].version = version;
				Projects.projectList[i].copyright = copyright;
				
				// check for language modules
				if (EditProject.currentProject.type == 'desktop')
				{
					// remove current rows
					TiDev.db.execute('DELETE FROM PROJECTMODULES WHERE guid = ?', EditProject.currentProject.guid);
					if (rubyOn == 'on')
					{
					    TiDev.db.execute("INSERT INTO PROJECTMODULES (guid, name, version) VALUES (?, ?, ?)", EditProject.currentProject.guid, 'ruby',Projects.currentRuntimeVersion);	
					}
					if (pythonOn == 'on')
					{
					    TiDev.db.execute("INSERT INTO PROJECTMODULES (guid, name, version) VALUES (?, ?, ?)", EditProject.currentProject.guid, 'python',Projects.currentRuntimeVersion);	
					}
					if (phpOn == 'on')
					{
					    TiDev.db.execute("INSERT INTO PROJECTMODULES (guid, name, version) VALUES (?, ?, ?)", EditProject.currentProject.guid, 'php',Projects.currentRuntimeVersion);	
					}

					Projects.projectList[i]['languageModules'] = {'ruby':rubyOn,'python':pythonOn,'php':phpOn};
				}
				break;
			}
		}

		
		TiDev.setConsoleMessage(message,delay);
	});
}

// setup event handler
EditProject.eventHandler = function(event)
{
	if (event == 'focus')
	{
		EditProject.setupView();
	}
	else if (event == 'load')
	{
		EditProject.setupView();
	}
};



// register module
TiDev.registerModule({
	name:'project_edit',
	displayName: 'Edit',
	perspectives:['projects'],
	html:'project_edit.html',
	idx:1,
	callback:EditProject.eventHandler
});


