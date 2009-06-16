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

	$('#edit_project_dir').html(displayDir);
	$('#edit_project_name').val(p.name);
	$('#edit_project_desc').val(p.description);
	$('#edit_project_publisher').val(p.publisher);	
	$('#edit_project_url').val(p.url);
	$('#edit_project_icon').val(p.image);
	$('#edit_project_runtime').val(p.runtime);
	$('#edit_project_appid').val(p.appid);
	$('#edit_project_version').val(p.version);
	$('#edit_project_copyright').val(p.copyright);
	
	if (p.type == 'mobile')
	{
		$('#edit_project_type').html('(Mobile Application)');
		$('#language_modules').css('display','none');
		$('#mobile_icon').css('display','inline');
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

	}
	
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
				
				// remove db data
				TiDev.db.execute('DELETE FROM PROJECTS WHERE ID = ?', EditProject.currentProject.id);
				TiDev.db.execute('DELETE FROM PROJECTMODULES WHERE GUID = ?', EditProject.currentProject.guid);

				// remove files
				var f = Titanium.Filesystem.getFile(EditProject.currentProject.dir);
				f.deleteDirectory(true);

				// remove from cache
				var a = [];
				for (var i=0;i<Projects.projectList.length;i++)
				{
					if (Projects.projectList[i].id != EditProject.currentProject.id)
					{
						// set new selected index to first row
						if (i==0)
						{
							Projects.selectedProjectIdx = Projects.projectList[i].id;
						}
						a.push(Projects.projectList[i]);
					}
				}
				Projects.projectList = a;

				// resetView
				Projects.setupView();

				TiDev.track('project-delete');

				TiDev.db.execute('DELETE FROM PROJECTPACKAGES WHERE GUID = ?', EditProject.currentProject.guid);
				TiDev.db.execute('DELETE FROM PROJECTDOWNLOADS WHERE GUID = ?', EditProject.currentProject.guid);
				TiDev.db.execute('DELETE FROM IPHONE_ATTRIBUTES WHERE ID = ?', EditProject.currentProject.id);

			}
			catch(e)
			{
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

		
	//
	// Save changes to project
	//
	$('#project_edit_save_button').click(function()
	{
		if ($(this).hasClass('disabled')) return;
		
		TiDev.track('project-edit');
		
		// save project and update cache
		var name = EditProject.currentProject.name = $('#edit_project_name').val();
		var desc = EditProject.currentProject.description =$('#edit_project_desc').val();
		var pub = EditProject.currentProject.publisher = $('#edit_project_publisher').val();	
		var url = EditProject.currentProject.url = $('#edit_project_url').val();
		var image = EditProject.currentProject.image = $('#edit_project_icon').val();
		var runtime = EditProject.currentProject.runtime = $('#edit_project_runtime').val();
		var appid = EditProject.currentProject.appid = $('#edit_project_appid').val();
		var version = EditProject.currentProject.version = $('#edit_project_version').val();
		var copyright = EditProject.currentProject.copyright = $('#edit_project_copyright').val();
		
		var message = 'Your changes have been saved';
		var delay = 2000;
		try
		{
			// insert record and push into cache
		    TiDev.db.execute("UPDATE PROJECTS SET runtime = ?, description = ?, name = ?,  publisher = ?, url = ?, image = ?, appid = ?, copyright = ?, version = ? WHERE id = ?", 
					runtime, desc, name, pub, url, image, appid, copyright, version, EditProject.currentProject.id );	
		}
		catch (e)
		{
			message = 'Unexpected error, message ' + e;
			delay = 5000;
		}

		// update tiapp.xml
		var tiapp = Titanium.Filesystem.getFile(EditProject.currentProject.dir,'tiapp.xml');
		var line = tiapp.readLine(true);
		var newXML = line + '\n';
		var inWindowSection = false;
		while (true)
		{
			line = tiapp.readLine();
			if(line==null)
			{
				break;
			} 
			if (line.indexOf('version') != -1)
			{
				newXML += '<version>' + version + '</version>\n';
				continue;
			}
			if (line.indexOf('name') != -1)
			{
				newXML += '<name>' + name + '</name>\n';
				continue;
			}
			if (line.indexOf('<window') != -1)
			{ 
				inWindowSection = true;
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
			if (line.indexOf('icon') != -1)
			{
				newXML += '<icon>' + image + '</icon>\n';
				continue;
			}
			if (line.indexOf('url') != -1 && inWindowSection == false)
			{
				newXML += '<url>' + url + '</url>\n';
				continue;
			}
			if (line.indexOf('copyright') != -1)
			{
				newXML += '<copyright>' + copyright + '</copyright>\n';
				continue;
			}
			newXML += line + '\n';
		}
		tiapp.write(newXML);

		// update cache
		for (var i=0;i<Projects.projectList.length;i++)
		{
			if (Projects.projectList[i].id == EditProject.currentProject.id)
			{
				Projects.projectList[i].name = name;
				Projects.projectList[i].descrption = desc;
				Projects.projectList[i].publisher = pub;
				Projects.projectList[i].url = url;
				Projects.projectList[i].image = image;
				Projects.projectList[i].runtime = runtime;
				Projects.projectList[i].appid = appid;
				Projects.projectList[i].version = version;
				Projects.projectList[i].copyright = copyright;
				
				// check for language modules
				if (EditProject.currentProject.type == 'desktop')
				{
					var rubyOn = ($('#language_ruby_checked').css('display') != 'none')?'on':'';
					var pythonOn = ($('#language_python_checked').css('display') != 'none')?'on':'';

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
					Projects.projectList[i]['languageModules'] = {'ruby':rubyOn,'python':pythonOn};
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
	else
	{
		
	}
};



// register module
TiDev.registerModule({
	name:'project_edit',
	displayName: 'Edit',
	perspectives:['projects'],
	html:'project_edit.html',
	idx:0,
	callback:EditProject.eventHandler
});

