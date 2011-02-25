PackageProject = {};
PackageProject.currentProject = null;
PackageProject.packageWindow = null;
PackageProject.mobileWindow = null;
PackageProject.currentAppPID = null;
PackageProject.currentIPhonePID = null;
PackageProject.currentAndroidPID = null;
PackageProject.currentAndroidEmulatorPID = null;
PackageProject.publishURL = "publish";
PackageProject.publishStatusURL = "publish-status";
PackageProject.isAndroidEmulatorRunning = false;
PackageProject.iPhoneDevPrereqs = {};

//Android vars
PackageProject.androidSDKs = [];

PackageProject.inConsoleMode = true;

// Mobile Script vars
PackageProject.iPhoneEmulatorPath = null;
PackageProject.AndroidEmulatorPath = null;
PackageProject.iPhonePrereqPath = null;
PackageProject.AndroidPrereqPath = null;
PackageProject.MobileProjectPath = null;
PackageProject.iPhoneProvisioningPath = null;
PackageProject.AndroidAvdPath = null;
PackageProject.sendAVD = false;
PackageProject.iphoneSDKs = null;

// Desktop Script var
PackageProject.desktopPackage = null;

// distribution iphone validator
PackageProject.iPhoneDistValidator = null; 

// Analytics-related vars
PackageProject.iphoneEmulatorStartDate = null;
PackageProject.androidEmulatorStartDate = null;
PackageProject.desktopAppLaunchDate = null;

// number of concurrent worker threads to create
PackageProject.worker_max = 5;


//
// called by the worker thread when a job is complete
//
PackageProject.job_complete=function(event)
{
	PackageProject.pending_jobs--;
	if (typeof(PackageProject.progress_callback)=='function')
	{
		PackageProject.progress_callback(event.message);
	}
	if (PackageProject.pending_jobs==0 && typeof(PackageProject.progress_complete)=='function')
	{
		PackageProject.progress_complete();
	}
}

// create a number of worker threads
PackageProject.workers = [];
PackageProject.pending_jobs = 0;
PackageProject.pending_callback = null;

for (var c=0;c<PackageProject.worker_max;c++)
{
	var compiler = Titanium.Worker.createWorker('app://modules/packaging/js/compiler.js');
	compiler.onmessage = PackageProject.job_complete;
	PackageProject.workers.push(compiler);
	compiler.start();
}

//
// Get Android Version
//
PackageProject.getAndroidVersion = function()
{
	try
	{
		var version = TiDev.db.execute('SELECT * FROM ANDROID_VERSION');
		while(version.isValidRow())
		{
			return {'version':version.fieldByName('VERSION'), 'skin':version.fieldByName('SKIN')};
		}
	}
	catch(e)
	{
		TiDev.db.execute('CREATE TABLE IF NOT EXISTS ANDROID_VERSION (VERSION TEXT, SKIN TEXT)');
	}
	return null;
};
//
// Save Android Version
//
PackageProject.saveAndroidVersion = function(version, skin)
{
	try
	{
		TiDev.db.execute('DELETE FROM ANDROID_VERSION');
		TiDev.db.execute('INSERT INTO ANDROID_VERSION VALUES(?, ?)', version, skin);
	}
	catch(e)
	{
		TiDev.db.execute('CREATE TABLE IF NOT EXISTS ANDROID_VERSION (VERSION TEXT, SKIN TEXT)');
	}
	return null;
};
PackageProject.compileResources = function(dir, progress_callback, progress_complete)
{
	function getRecursiveDirectoryListing(file)
	{
		if (file.isDirectory())
		{
			var set = [];
			var children = file.getDirectoryListing();
			for (var i=0;i<children.length;i++)
			{
				var childSet = getRecursiveDirectoryListing(children[i]);
				for (var j=0;j<childSet.length;j++)
				{
					set.push(childSet[j]);
				}
			}
			return set;
		}
		else
		{
			return [file];
		}
	};
		
	var resources = Titanium.Filesystem.getFile(dir);
	var jobs = getRecursiveDirectoryListing(resources);

	// reset pending jobs
	PackageProject.pending_jobs = 0;
	PackageProject.progress_callback = progress_callback;
	PackageProject.progress_complete = progress_complete;
	
	var worker_idx = 0;
	var job_id = 0;
	var job_count = 0;
	
	for (var c=0;c<jobs.length;c++,worker_idx++)
	{
		// pull out a worker so we can distribute the jobs
		var job = jobs[c];
		
		if (job.isFile() && job.extension()=="js")
		{
			var idx = worker_idx % PackageProject.workers.length;
			var worker = PackageProject.workers[idx];
			
			PackageProject.pending_jobs++;

			// figure out the relative path
			var path = job.nativePath().substring(resources.nativePath().length+1);

			job_count++;
			
			// queue the worker to be compiled
			worker.postMessage({path:path,file:job.nativePath(),id:job_id++});
		}
	}
	
	if (job_count==0)
	{
		PackageProject.progress_complete();
	}
}

//
// add close listener to close emulators if still running
//
Titanium.UI.currentWindow.addEventListener(function(name,event)
{
	if (name == 'closed')
	{
		if (PackageProject.currentIPhonePID != null)
		{
			PackageProject.currentIPhonePID.terminate();
		}
		if (PackageProject.currentAndroidPID != null)
		{
			PackageProject.currentAndroidPID.terminate();
		}
		if (PackageProject.currentAndroidEmulatorPID != null)
		{
			PackageProject.currentAndroidEmulatorPID.terminate();
		}
		
	}
});

//
// Setup row selection listener
//
$MQL('l:tidev.projects.row_selected',function(msg)
{
	if (msg.payload.activeTab == 'packaging')
	{
		PackageProject.currentProject = Projects.getProject();
		var file = Titanium.Filesystem.getFile(Titanium.App.appURLToPath('modules/packaging/packaging.html'));
		$('#tiui_content_right').get(0).innerHTML = file.read();

		if (PackageProject.currentProject.type == 'mobile' || 
			PackageProject.currentProject.type == 'ipad' ||
			PackageProject.currentProject.type == 'universal')
		{
			PackageProject.setupMobileView();
		}
		else
		{
			PackageProject.setupDesktopView();
		}
		PackageProject.initializeConsoleWidth()
	}
});

//
// this is a generic compiler function that is used by both android and iphone
//
PackageProject.mobileCompile = function(dir,platform,callback)
{
	PackageProject.initializeConsoleWidth();
	
	// start compile
	$('#mobile_'+platform+'_emulator_viewer').append('<div style="margin-bottom:3px;" class="log_info">[INFO] Compiling JavaScript...one moment</div>');
	$('#mobile_'+platform+'_emulator_viewer').get(0).scrollTop = $('#mobile_'+platform+'_emulator_viewer').get(0).scrollHeight;
	
	var compiler_errors = 0;
	var completed = false;

	PackageProject.compileResources(dir,
	function(event){
			if (!event.result)
			{
				for (var c=0;c<event.errors.length;c++)
				{
					var e = event.errors[c];
					if (e.reason.indexOf("Use '===' to compare")==0 || 
					    e.reason.indexOf("Use '!==' to compare")==0 ||
					    e.reason.indexOf("Unnecessary semicolon")==0)
					{
						// skip these errors
						continue;
					}
					compiler_errors++;
					if (e.reason.indexOf('Too many errors.')!=-1)
					{
						$('#mobile_'+platform+'_emulator_viewer').append('<div style="margin-bottom:3px;" class="log_error">[ERROR] JavaScript compiler (JSLint) reported "Too many errors". Attempting to continue... </div>');
						$('#mobile_'+platform+'_emulator_viewer').get(0).scrollTop = $('#mobile_'+platform+'_emulator_viewer').get(0).scrollHeight;
						completed = true;
						callback();
						break;
					}
					$('#mobile_'+platform+'_emulator_viewer').append('<div style="margin-bottom:3px;" class="log_warn">[WARN] JavaScript compiler reported "'+ e.reason + '" at ' + event.path + ":"+e.line+'</div>');
					$('#mobile_'+platform+'_emulator_viewer').get(0).scrollTop = $('#mobile_'+platform+'_emulator_viewer').get(0).scrollHeight;
				}
			}
	},
	function()
	{
		if (compiler_errors===0)
		{
			$('#mobile_'+platform+'_emulator_viewer').append('<div style="margin-bottom:3px;" class="log_info">[INFO] No JavaScript errors detected.</div>');
			$('#mobile_'+platform+'_emulator_viewer').get(0).scrollTop = $('#mobile_'+platform+'_emulator_viewer').get(0).scrollHeight;
		}
		if (!completed)
		{
			completed = true;
			callback();
		}
	});
};

//
// View setup
//
PackageProject.setupView = function()
{

	TiUI.setBackgroundColor('#1c1c1c');

	TiDev.contentLeft.show();
	TiDev.contentLeftHideButton.show();
	TiDev.contentLeftShowButton.hide();	
	
	// get current project
	PackageProject.currentProject = Projects.getProject();

	if (PackageProject.currentProject.type == 'mobile' || 
		PackageProject.currentProject.type == 'ipad' ||
		PackageProject.currentProject.type == 'universal')
	{
		PackageProject.setupMobileView();
	}
	// setup desktop elements
	else
	{
		PackageProject.setupDesktopView();
	}
	PackageProject.initializeConsoleWidth();
};

PackageProject.openResource = function(id)
{
	var el = $('#'+id);
	var fn = el.attr('fn');
	var ln = el.attr('ln');
	var msg = el.get(0).msg;
	
	Titanium.UI.showDialog({
		'url': 'app://modules/packaging/resource_view.html',
		'width': 700,
		'height': 500,
		'resizable':true,
		'parameters':{
			'file':fn,
			'line':ln,
			'msg':msg
		}
	});
};

PackageProject.logReaderWorkers={};

PackageProject.removeReaderProcess = function(platform,type)
{
	var cur_process = PackageProject.logReaderWorkers[platform+'-'+type];
	
	if (cur_process)
	{
		delete PackageProject.logReaderWorkers[platform+'-'+type];
		cur_process.terminate();
		cur_process=null;
	}
}
PackageProject.safeLogContent = function(msg)
{
	var div = document.createElement('div');
	var text = document.createTextNode(msg);
	div.appendChild(text);
	return div.innerHTML;
}
PackageProject.logReader = function(process,platform,type,filterFunc)
{
	PackageProject.removeReaderProcess(platform,type);
	PackageProject.logReaderWorkers[platform+'-'+type]=process;
	
	var buf = '';
	var verbose = false;
	var skip = false;
	var verbose_id = null;
	var compiler_started = null;
	//TODO: consider placing this on event queue
	process.setOnRead(function(event)
	{
		var d = event.data.toString();
		buf += d;
		var idx = buf.indexOf('\n');
		var exception_msg = null;
		var exception_id = null;
		while (idx!=-1)
		{
			var str = buf.substring(0,idx);
			if (filterFunc)
			{
				str = filterFunc(str);
			}
			var cls = '';
			// attempt to color code any special output lines
			if (str.indexOf('[EXCEPTION]')!=-1)
			{
				cls='log_unhandled_exception';
				var a = str.indexOf(']');
				var i = str.indexOf(':');
				var fn = str.substring(a+2,i);
				var y = str.indexOf(' ',i+1);
				var line = str.substring(i+1,y);
				var f = Titanium.Filesystem.getFile(PackageProject.currentProject.dir,'Resources',fn);
				if (!f.exists())
				{
					f = Titanium.Filesystem.getFile(PackageProject.currentProject.dir,'Resources',platform,fn);
				}
				if (f.exists())
				{
					exception_msg = str.substring(y+1);
					exception_id = 'exception_'+new Date().getTime();
					str = "[EXCEPTION] <a fn='"+f.nativePath()+"' ln='"+line+"' id='"+exception_id+"' onclick='PackageProject.openResource(\""+exception_id+"\");return false;'>" + fn + ":" + line + "</a> " + exception_msg;
				}
			}
			else if (str.indexOf('[TRACE]')!=-1)
			{
				cls = 'log_trace';
			}
			else if (str.indexOf('[ERROR]')!=-1)
			{
				cls='log_error';
			}
			else if (str.indexOf('[WARN]')!=-1)
			{
				cls='log_warn';
			}
			else if (str.indexOf('[DEBUG]')!=-1)
			{
				cls='log_debug';
			}
			else if (str.indexOf('[INFO]')!=-1)
			{
				cls='log_info';
			}
			else if (str.indexOf('[FATAL]')!=-1)
			{
				cls='log_fatal';
			}
			else if (str.indexOf('[CRITICIAL]')!=-1)
			{
				cls='log_critical';
			}
			else if (str.indexOf('[BEGIN_VERBOSE]')!=-1)
			{
				verbose=true;
				skip=true;
				compiler_started = new Date().getTime();
				verbose_id = 'verbose_' + (new Date().getTime());
				var _str = str.substring('[BEGIN_VERBOSE]'.length+1);
				var show = PackageProject.logFilterVisible('log_info',platform) ? 'block':'none';
				var html = '<div style="margin-bottom:3px;display:'+show+';cursor:pointer;" class="log_info verbose_logger" id="'+verbose_id+'">[INFO] '+ _str + '</div>';
				$('#mobile_'+platform+'_emulator_viewer').append(html);
				var the_id = verbose_id;
				$("#"+the_id).click(function()
				{
					if($('#'+the_id).hasClass('visible'))
					{
						$('#'+the_id+' > .log_verbose').css('display','none');
						$('#'+the_id).removeClass('visible');
					}
					else
					{
						$('#'+the_id+' > .log_verbose').css('display','block');
						$('#'+the_id).addClass('visible');
					}
					$('#mobile_'+platform+'_emulator_viewer').get(0).scrollTop = $('#mobile_'+platform+'_emulator_viewer').get(0).scrollHeight;
				});
			}
			else if (str.indexOf('[END_VERBOSE]')!=-1)
			{
				verbose=false;
				skip=true;
				verbose_id = null;
				var duration = ((new Date().getTime()) - compiler_started) / 1000;
				var show = PackageProject.logFilterVisible('log_info',platform) ? 'block':'none';
				$('#mobile_'+platform+'_emulator_viewer').append('<div style="margin-bottom:3px;display:'+show+';" class="log_info">[INFO] Compile completed in '+duration+' seconds</div>');
				$('#mobile_'+platform+'_emulator_viewer').get(0).scrollTop = $('#mobile_'+platform+'_emulator_viewer').get(0).scrollHeight;
			}
			else if (platform=='iphone' && str.indexOf("Terminating in response to SpringBoard's termination")!=-1)
			{
				// we can ignore this
				skip=true;
			}
			if (verbose)
			{
				cls='log_verbose';
			}
			if (!skip)
			{
				var display = PackageProject.logFilterVisible(cls,platform)==false ? 'display:none': '';
				var html = '<div style="margin-bottom:3px;'+display+';" class="'+cls+'">'+ PackageProject.safeLogContent(str) + '</div>';
				if (verbose_id)
				{
					$('#'+verbose_id).append(html);
				}
				else
				{
					$('#mobile_'+platform+'_emulator_viewer').append(html);
					
					if (exception_id)
					{
						$('#'+exception_id).get(0).msg = exception_msg;
					}
				}
				$('#mobile_'+platform+'_emulator_viewer').get(0).scrollTop = $('#mobile_'+platform+'_emulator_viewer').get(0).scrollHeight;
			}
			else
			{
				skip=false;
			}
			if (idx+1 < buf.length)
			{
				buf = buf.substring(idx+1);
				idx = buf.indexOf('\n');
			}
			else
			{
				buf = '';
				break;
			}
		}
	});
};

//
// function that will perform log filtering for the console
//
PackageProject.logFilterVisible = function(cls,platform)
{
	if (cls=='log_verbose') return false;
	var show = true;
	var level = $('#'+platform+'_log_filter').val();
	if (level == 'info')
	{
		if (cls=='log_debug' || cls=='log_trace')
		{
			show=false;
		}
	}
	else if (level == 'debug')
	{
		if (cls == 'log_trace')
		{
			show=false;
		}
	}
	else if (level == 'warn')
	{
		if (cls=='log_trace' || cls=='log_debug' || cls=='log_info' || cls.indexOf('verbose_logger visible')!=-1)
		{
			show=false;
		}
	}
	else if (level == 'error')
	{
		show=(cls=='log_error' || cls=='log_unhandled_exception');
	}
	return show;
};

//
// Setup view for mobile project
//
PackageProject.setupMobileView = function()
{
	var runtime = PackageProject.currentProject.runtime;
	var sdk = Titanium.Project.getMobileSDKVersions(runtime);

	// set scripts for current sdk version
	PackageProject.iPhoneEmulatorPath = Titanium.Filesystem.getFile(sdk.getPath(),'/iphone/builder.py');
	PackageProject.AndroidEmulatorPath = Titanium.Filesystem.getFile(sdk.getPath(),'/android/builder.py');
	PackageProject.iPhoneProvisioningPath = Titanium.Filesystem.getFile(sdk.getPath(),'iphone/provisioner.py');
	PackageProject.iPhonePrereqPath = Titanium.Filesystem.getFile(sdk.getPath(),'iphone/prereq.py');
	PackageProject.AndroidPrereqPath = Titanium.Filesystem.getFile(sdk.getPath(),'android/prereq.py');
	PackageProject.AndroidAvdPath = Titanium.Filesystem.getFile(sdk.getPath(),'android/avd.py');

	// initialize ad
	$('#mobile_ads').html(TiDev.mobileEmulatorContent);

	// show correct view
	$('#mobile_packaging').css('display','block');
	$('#desktop_packaging').css('display','none');
	$('#mobile_emulator_container').css('display','block');
	$('#mobile_device_detail').css('display','none');	
	$('#mobile_distribution_detail').css('display','none');	
	$('#packaging .tab.emulator.active').click();
	
	$('#mobile_emulator').click(function()
	{
		$('#mobile_emulator_container').css('display','block');
		$('#mobile_device_detail').css('display','none');	
		$('#mobile_distribution_detail').css('display','none');	
		$('#packaging .option').removeClass('active');
		
		$('#packaging .tab.emulator.active').click();
		
		$('#mobile_ads').html(TiDev.mobileEmulatorContent);
		
		$(this).addClass('active');
		
	});

	// setup tabs for "emulator"
	$('#tab_iphone_emulator').click(function()
	{
		$('.help_header.tab.emulator').removeClass('active');
		$(this).addClass('active');
		$('#mobile_iphone_emulator_container').css('display','block');
		$('#mobile_android_emulator_container').css('display','none');
		PackageProject.initializeConsoleWidth();
	});
	$('#tab_android_emulator').click(function()
	{
		$('.help_header.tab.emulator').removeClass('active')
		$(this).addClass('active')
		$('#mobile_iphone_emulator_container').css('display','none');
		$('#mobile_android_emulator_container').css('display','block');
		PackageProject.initializeConsoleWidth();
	});
	
	// setup tabs for "device"
	$('#tab_iphone_dev').click(function()
	{
		$('.help_header.tab.device').removeClass('active');
		$(this).addClass('active');
		$('#mobile_device_content_iphone').css('display','block');
		$('#mobile_device_content_android').css('display','none');
		PackageProject.initializeConsoleWidth();
	});
	$('#tab_android_dev').click(function()
	{
		$('.help_header.tab.device').removeClass('active')
		$(this).addClass('active')
		$('#mobile_device_content_iphone').css('display','none');
		$('#mobile_device_content_android').css('display','block');
		PackageProject.initializeConsoleWidth();
	});
	
	// setup tabs for "packaging"
	$('#tab_iphone_package').click(function()
	{
		$('.help_header.tab.packaging').removeClass('active');
		$(this).addClass('active');
		$('#mobile_packaging_content_iphone').css('display','block');
		$('#mobile_packaging_content_android').css('display','none');
		PackageProject.initializeConsoleWidth();
	});
	$('#tab_android_package').click(function()
	{
		$('.help_header.tab.packaging').removeClass('active')
		$(this).addClass('active')
		$('#mobile_packaging_content_iphone').css('display','none');
		$('#mobile_packaging_content_android').css('display','block');
		PackageProject.initializeConsoleWidth();
	});
	

	if (Titanium.platform != "osx")
	{
		$('#mobile_emulator_iphone').hide();
		$('#tab_iphone_dev').hide();
		$('#tab_iphone_package').hide();

		$('#mobile_emulator_android').click();
		$('#tab_android_dev').click();
		$('#tab_android_package').click();
	}

	$("#android_log_filter").change(function()
	{
		var level = $(this).val();
		$.each($("#mobile_android_emulator_viewer > div"),function()
		{
			var cls = $(this).attr('class');
			var show = PackageProject.logFilterVisible(cls,'android');
			$(this).css('display',show ? 'block':'none');
		});
	});
	
	$("#iphone_log_filter").change(function()
	{
		var level = $(this).val();
		$.each($("#mobile_iphone_emulator_viewer > div"),function()
		{
			var cls = $(this).attr('class');
			var show = PackageProject.logFilterVisible(cls,'iphone');
			$(this).css('display',show ? 'block':'none');
		});
	});
	
	// check project for iphone
	
	if (PackageProject.currentProject.platforms.ios == true)
	{		
		var buildpath = Titanium.Filesystem.getFile(PackageProject.currentProject.dir,'build','iphone');
		if (buildpath.exists() != true)
		{
			buildpath.createDirectory();
		}
		var deviceFamily = (PackageProject.currentProject.type=='mobile') ? 'iphone' : PackageProject.currentProject.type;
		
		// setup distribution validation
		PackageProject.iPhoneDistValidator = TiUI.validator('iphone_dist',function(valid)
		{
			// now check field
			if (valid) 
			{
				$('#iphone_package_button').removeClass('disabled');
			}
			else
			{
				$('#iphone_package_button').addClass('disabled');
			}
		});
		
		// retrieve distribution location
		var location = PackageProject.getIPhoneAttribute('dist_location');
		if (location != null) $('#iphone_dist_location').val(location);
		
		// distribution provisioning profile link
		$('#upload_dist_profile_link').click(function()
		{
			PackageProject.uploadIPhoneProvisioningProfile('distribution_profile', function(r)
			{
				if (r.result == true)
				{
					// show select
					$('.not_found.dist_profile').css('display','none');
					$('.found.dist_profile').css('display','block');

					// we have a profile so hide other stuff that can be inferred
					$('#dist_iphone_signup').css('display','none');
					$('.register_phone').css('display','none');

					// update select
					PackageProject.updateProvisioningSelect('iphone_dist_profile_select',
						PackageProject.getIPhoneProvisioningProfiles('distribution'),r.uuid);
					
					// reset console
					TiDev.resetConsole();

					// update state var
					PackageProject.iPhoneDevPrereqs['iphone_dist_profile'] = true;

					// check state
					PackageProject.checkIPhoneDistPrereqs();
					
				}
				else
				{
					TiDev.setConsoleMessage('Unexpected Error: unable to load provisioning profile.  Please try again.',2000);
				}
			});
		});

		// add dist cert select listener (distribution)
		$('#iphone_dist_cert_select').change(function()
		{
			if ($(this).val()=='')return;
			PackageProject.setIPhoneAttribute('dist_name',$(this).val());
		});

		// add provisioning profile select listener (distribution)
		$('#iphone_dist_profile_select').change(function()
		{
			if ($(this).val()=='')return;

			var el =  document.getElementById('iphone_dist_profile_select');
			var text = el.options(el.selectedIndex).text;
			var uuidStr = text.split('uuid:')

			PackageProject.setIPhoneAttribute('dist_uuid',uuidStr[1]);

			PackageProject.setIPhoneAttribute('distribution_profile',$(this).val());
			PackageProject.iPhoneDevPrereqs['iphone_dist_profile'] = true;					
			PackageProject.checkIPhoneDistPrereqs();
				
			// update project
			PackageProject.updateMobileAppId($(this).val());
		});
		
		// add new provisioning profile even if you have a valid one (distribution)
		$('#add_dist_profile_link').click(function()
		{
			PackageProject.uploadIPhoneProvisioningProfile('distribution_profile', function(r)
			{
				if (r.result == true)
				{
					// update select
					PackageProject.updateProvisioningSelect('iphone_dist_profile_select',
						PackageProject.getIPhoneProvisioningProfiles('distribution'),r.uuid);
						
					// update project
					PackageProject.setIPhoneAttribute('distribution_profile',r.appid);

					// update project
					PackageProject.updateMobileAppId(r.appid);
					
					// reset message console	
					TiDev.resetConsole();

				}
				else
				{
					TiDev.setConsoleMessage('Unexpected Error: unable to load provisioning profile.  Please try again.',2000);
				}
			});
		});

		// add dev cert select listener (development)
		$('#iphone_dev_cert_select').change(function()
		{
			if ($(this).val()=='')return;
			PackageProject.setIPhoneAttribute('dev_name',$(this).val());
		});

		// add provisioning profile select listener (Development)
		$('#iphone_dev_profile_select').change(function()
		{
			if ($(this).val()=='')return;
			
			var el =  document.getElementById('iphone_dev_profile_select');
			var text = el.options(el.selectedIndex).text;
			var uuidStr = text.split('uuid:')
			
			// need to find UUID for selected profile
			PackageProject.setIPhoneAttribute('dev_uuid',uuidStr[1]);
			PackageProject.setIPhoneAttribute('development_profile',$(this).val());
			PackageProject.updateMobileAppId($(this).val());
			// update state var
			PackageProject.iPhoneDevPrereqs['iphone_dev_profile'] = true;

			// check state
			PackageProject.checkIPhoneDevPrereqs();
		
		});
		
		$('#remove_dev_profile_link').click(function()
		{
			var el =  document.getElementById('iphone_dev_profile_select');
			var value = el.options(el.selectedIndex).value;
			var text = el.options(el.selectedIndex).text;
			var uuidStr = text.split('uuid:')
			if (value == '')
			{
				alert('You must select a profile to delete first.');
				return;
			}
			
			if (confirm('Are you sure you want to delete the profile:\n' + text))
			{
				// remove matching profile
				PackageProject.removeIPhoneProvisioningProfile('development',uuidStr[1]);
				
				// update select
				PackageProject.updateProvisioningSelect('iphone_dev_profile_select',
					PackageProject.getIPhoneProvisioningProfiles('development'));
					
				// reset profile uuid 
				PackageProject.setIPhoneAttribute('dev_uuid',null);
				
				// set tracking var to false
				PackageProject.iPhoneDevPrereqs['iphone_dev_profile'] = false;

				// check state
				PackageProject.checkIPhoneDevPrereqs();
			}
		});
		
		// add new provisioning profile even if you have a valid one
		$('#add_dev_profile_link').click(function()
		{
			PackageProject.uploadIPhoneProvisioningProfile('development_profile', function(r)
			{
				if (r.result == true)
				{
					// update select
					PackageProject.updateProvisioningSelect('iphone_dev_profile_select',
						PackageProject.getIPhoneProvisioningProfiles('development'),r.uuid);
						
					PackageProject.setIPhoneAttribute('development_profile',r.appid);
					
					// update project
					PackageProject.updateMobileAppId(r.appid);
					
					// reset message console	
					TiDev.resetConsole();

				}
				else
				{
					TiDev.setConsoleMessage('Unexpected Error: unable to load provisioning profile.  Please try again.',2000);
				}
			});
		});
		
		// add initial dev provisioning profile
		$('#upload_dev_profile_link').click(function()
		{
			PackageProject.uploadIPhoneProvisioningProfile('development_profile', function(r)
			{
				if (r.result == true)
				{
					// show select
					$('.not_found.dev_profile').css('display','none');
					$('.found.dev_profile').css('display','block');

					// we have a profile so hide other stuff that can be inferred
					$('#dev_iphone_signup').css('display','none');
					$('.register_phone').css('display','none');

					// update select
					PackageProject.updateProvisioningSelect('iphone_dev_profile_select',
						PackageProject.getIPhoneProvisioningProfiles('development'),r.uuid);
					
					// reset console
					TiDev.resetConsole();

					// update state var
					PackageProject.iPhoneDevPrereqs['iphone_dev_profile'] = true;

					// check state
					PackageProject.checkIPhoneDevPrereqs();
					
				}
				else
				{
					TiDev.setConsoleMessage('Unexpected Error: unable to load provisioning profile.  Please try again.',2000);
				}
			});
		});
		
		// see what iphone prereqs the user has then drive UI state
		var x = TiDev.launchPython([Titanium.Filesystem.getFile(PackageProject.iPhonePrereqPath).toString(), 'package']);
		x.setOnRead(function(event)
		{
			try
			{
				var d = event.data.toString();
				var json = swiss.evalJSON(d);
				// set prereq vars
				PackageProject.iPhoneDevPrereqs['itunes'] = json['itunes'];
				PackageProject.iPhoneDevPrereqs['wwdr'] = json['wwdr'];
				PackageProject.iPhoneDevPrereqs['iphone_dev'] = json['iphone_dev'];
				PackageProject.iPhoneDevPrereqs['iphone_dist'] = json['iphone_dist'];
				PackageProject.iPhoneDevPrereqs['iphone_dist_name'] = json['iphone_dist_name'];
				
				// set SDK dropdowns
				PackageProject.iphoneSDKs  = json.sdks;
				if (json.sdks)
				{
					var simHtml = '';
					var deviceHtml = '';
					for(var i=0;i<json.sdks.length;i++)
					{
						var line = '<option value="'+json.sdks[i]+'">'+json.sdks[i] + '</option>';
						var isPadOnly = (json.sdks[i].substring(0,3) == '3.2');
						var isPadOS = false;
						if (PackageProject.currentProject.type == 'ipad' || 
							$('#iphone_simulator_device') == 'ipad')
						{
							// ipad-only is supported with 3.2 and 4.2+
							if (isPadOnly || 
								(parseInt(json.sdks[i][0]) == 4 && parseInt(json.sdks[i][2]) >= 2) ||
								(parseInt(json.sdks[i][0]) > 4))
							{
								simHtml += line;
								isPadOS = true;
							}
						}
						else
						{
							if ($('#iphone_simulator_device').val() == 'iphone' &&
								!isPadOnly) 
							{
								simHtml += line;
							}
						}
						
						// deviceHtml needs to match project type, NOT selected
						// simulator:
						switch (PackageProject.currentProject.type) {
							case 'mobile':
								if (!isPadOnly) {
									deviceHtml += line;
								}
								break;
							case 'ipad':
								if (isPadOS) {
									deviceHtml += line;
								}
								break;
							default:
								deviceHtml += line;
						}
						
					}
					$('#iphone_emulator_sdk').html(simHtml);
					$('#iphone_device_sdk').html(deviceHtml);
					$('#iphone_distribution_sdk').html(deviceHtml);
					
				}
				// correct version of iTunes
				if (json['itunes'] == true)
				{
					$('.found.itunes').css('display','inline');
					$('.not_found.itunes').css('display','none');
				}
				else
				{
					$('.found.itunes').css('display','none');
					$('.not_found.itunes').css('display','inline');
				}

				// wwdr intermediate certificate
				if (json['wwdr'] == true)
				{
					$('.found.wwdr').css('display','inline');
					$('.not_found.wwdr').css('display','none');	
					$('#dev_iphone_signup').css('display','none');
					$('#package_iphone_signup').css('display','none');
				}
				else
				{
					$('.found.wwdr').css('display','none');
					$('.not_found.wwdr').css('display','inline');				
				}

				// iphone development certificate
				if (json['iphone_dev'] == true)
				{
					if (json['iphone_dev_name'].length > 1)
					{
						// display drop down and update values
						$('.found.dev_cert_multiple').css('display','inline');
						$('.found.dev_cert').css('display','none');
						var html = '';
						var distName = PackageProject.getIPhoneAttribute('dev_name');
						if (distName == null)
						{
							html += '<option value="">Select a Development Certificate</option>';
						}
						for (var i=0;i<json['iphone_dev_name'].length;i++)
						{
							if (distName == json['iphone_dev_name'][i])
							{
								html += '<option value="'+json['iphone_dev_name'][i] +'" selected>'+json['iphone_dev_name'][i]+'</option>';							
							}
							else
							{
								html += '<option value="'+json['iphone_dev_name'][i] +'" >'+json['iphone_dev_name'][i]+'</option>';							
							}
						}
						$('#iphone_dev_cert_select').html(html);
					}
					else if (json['iphone_dev_name'].length == 1)
					{
						// update dist name
						PackageProject.setIPhoneAttribute('dev_name',json['iphone_dev_name']);
						
						$('#iphone_dev_cert_select').html('<option value="'+json['iphone_dev_name']+'" selected>'+json['iphone_dev_name']+'</option>');
						$('.found.dev_cert').css('display','none');
						$('.found.dev_cert_multiple').css('display','inline');
					}
					$('.not_found.dev_cert').css('display','none');
					$('#dev_iphone_signup').css('display','none');
					$('#package_iphone_signup').css('display','none');
				}
				else
				{
					$('.found.dev_cert').css('display','none');
					$('.not_found.dev_cert').css('display','block');
				}


				// iphone development certificate
				if (json['iphone_dist'] == true)
				{
					if (json['iphone_dist_name'].length > 1)
					{
						// display drop down and update values
						$('.found.dist_cert_multiple').css('display','inline');
						$('.found.dist_cert').css('display','none');
						var html = '';
						var distName = PackageProject.getIPhoneAttribute('dist_name');
						if (distName == null)
						{
							html += '<option value="">Select a Distribution Certificate</option>';
						}
						for (var i=0;i<json['iphone_dist_name'].length;i++)
						{
							if (distName == json['iphone_dist_name'][i])
							{
								html += '<option value="'+json['iphone_dist_name'][i] +'" selected>'+json['iphone_dist_name'][i]+'</option>';							
							}
							else
							{
								html += '<option value="'+json['iphone_dist_name'][i] +'" >'+json['iphone_dist_name'][i]+'</option>';							
							}
						}
						$('#iphone_dist_cert_select').html(html);
					}
					else if (json['iphone_dist_name'].length == 1)
					{
						// set (and insert dist name)
						PackageProject.setIPhoneAttribute('dist_name',json['iphone_dist_name']);
						
						$('#iphone_dist_cert_select').html('<option value="'+json['iphone_dist_name']+'" selected>'+json['iphone_dist_name']+'</option>');
						$('.found.dist_cert').css('display','none');
						$('.found.dist_cert_multiple').css('display','inline');
					}
					$('.not_found.dist_cert').css('display','none');
					$('#dev_iphone_signup').css('display','none');
					$('#package_iphone_signup').css('display','none');


				}
				else
				{
					$('.found.dist_cert').css('display','none');
					$('.not_found.dist_cert').css('display','block');
				}


				// get provisioning profiles (distribution)
				var profiles = PackageProject.getIPhoneProvisioningProfiles('distribution');
				if (profiles.length > 0)
				{
					$('.not_found.dist_profile').css('display','none');
					$('.found.dist_profile').css('display','block');

					var selectedProfile = PackageProject.getIPhoneAttribute('dist_uuid');
					if (selectedProfile == null)
					{
						PackageProject.iPhoneDevPrereqs['iphone_dist_profile'] = false;					
					}
					else
					{
						PackageProject.iPhoneDevPrereqs['iphone_dist_profile'] = true;					
					}
					PackageProject.updateProvisioningSelect('iphone_dist_profile_select',profiles, selectedProfile);
					$('#dev_iphone_signup').css('display','none');
					$('.register_phone').css('display','none');
				}
				else
				{
					$('.not_found.dist_profile').css('display','block');
					$('.found.dist_profile').css('display','none');
					PackageProject.iPhoneDevPrereqs['iphone_dist_profile'] = false;
				}

				// get provisioning profiles (development)
				var profiles = PackageProject.getIPhoneProvisioningProfiles('development');
				if (profiles.length > 0)
				{
					$('.not_found.dev_profile').css('display','none');
					$('.found.dev_profile').css('display','block');

					var selectedProfile = PackageProject.getIPhoneAttribute('dev_uuid');
					if (selectedProfile == null)
					{
						PackageProject.iPhoneDevPrereqs['iphone_dev_profile'] = false;					
					}
					else
					{
						PackageProject.iPhoneDevPrereqs['iphone_dev_profile'] = true;					
					}
					PackageProject.updateProvisioningSelect('iphone_dev_profile_select',profiles, selectedProfile);
					$('#dev_iphone_signup').css('display','none');
					$('.register_phone').css('display','none');
				}
				else
				{
					$('.not_found.dev_profile').css('display','block');
					$('.found.dev_profile').css('display','none');
					PackageProject.iPhoneDevPrereqs['iphone_dev_profile'] = false;
				}

				// check state
				PackageProject.checkIPhoneDevPrereqs();
				PackageProject.checkIPhoneDistPrereqs();


				
			}
			catch(e)
			{
			}
			
		});
		x.launch();
		
		// set display of "device" section
		$('.project_has_iphone_true').css('display','block');
		$('.project_has_iphone_false').css('display','none');

		$('#remove_dist_profile_link').click(function()
		{
			var el =  document.getElementById('iphone_dist_profile_select');
			var value = el.options(el.selectedIndex).value;
			var text = el.options(el.selectedIndex).text;
			var uuidStr = text.split('uuid:')
			if (value == '')
			{
				alert('You must select a profile to delete first.');
				return;
			}
			
			if (confirm('Are you sure you want to delete the profile:\n' + text))
			{
				// remove matching profile
				PackageProject.removeIPhoneProvisioningProfile('distribution',uuidStr[1]);
				
				// update select
				PackageProject.updateProvisioningSelect('iphone_dist_profile_select',
					PackageProject.getIPhoneProvisioningProfiles('distribution'));
					
				// reset profile uuid 
				PackageProject.setIPhoneAttribute('dist_uuid',null);
				
				// set tracking var to false
				PackageProject.iPhoneDevPrereqs['iphone_dist_profile'] = false;

				// check state
				PackageProject.checkIPhoneDistPrereqs();
			}
		});

		// handler for distribution location
		$('#add_dist_location_link').click(function()
		{
			var props = {multiple:false,directories:true,files:false};
			Titanium.UI.currentWindow.openFolderChooserDialog(function(f)
			{
				if (f.length)
				{
					// set file and revalidate
					$('#iphone_dist_location').val(f[0]);
					PackageProject.iPhoneDistValidator();
					PackageProject.setIPhoneAttribute('dist_location',f[0]);
				}
			},
			props);						
		});
		
		// create button for building distribution
		TiUI.GreyButton({id:'iphone_package_button'});
		$('#iphone_package_button').click(function()
		{
			if ($(this).hasClass('disabled')) return true;
			
			TiDev.setConsoleMessage('Creating distribution package...');
			
			var uuid = PackageProject.getIPhoneAttribute('dist_uuid');
			var certName = PackageProject.getIPhoneAttribute('dist_name');
			var location = $('#iphone_dist_location').val();
			var sdk = $('#iphone_distribution_sdk').val();
			var type = (PackageProject.currentProject.type=='mobile') ? 'iphone' : PackageProject.currentProject.type;
			Titanium.Analytics.featureEvent(type +'.distribute',{sdk:sdk,appid:PackageProject.currentProject.appid,name:PackageProject.currentProject.name,guid:PackageProject.currentProject.guid,certName:certName});
			var x = TiDev.launchPython([Titanium.Filesystem.getFile(PackageProject.iPhoneEmulatorPath).toString(),'distribute','"'+sdk+'"', '"'+ PackageProject.currentProject.dir+ '"',PackageProject.currentProject.appid, '"' + PackageProject.currentProject.name+ '"', uuid,'"'+certName+'"','"'+location+'"', deviceFamily]);
			var buffer = '';
			x.setOnRead(function(event)
			{
				var row = event.data.toString();
				if (row.indexOf('[ERROR]') != -1 && row.indexOf('** BUILD FAILED **') == -1)
				{
					buffer+= row.replace('[ERROR]','');
				}
			});
			x.setOnExit(function(event)
			{
				if (x.getExitCode() != 0)
				{
					alert('Packaging Error\n\n' + buffer);
				}
				TiDev.showDefaultSystemMessage()

			});
			x.launch();
		});
		
		// create button for installing on device
		TiUI.GreyButton({id:'iphone_install_on_device_button'});
		$('#iphone_install_on_device_button').click(function()
		{
			if ($(this).hasClass('disabled'))return;
			var uuid = PackageProject.getIPhoneAttribute('dev_uuid');
			var devName = PackageProject.getIPhoneAttribute('dev_name');
			TiDev.setConsoleMessage('Installing app onto iTunes...');
			
			if ($(this).hasClass('disabled')==false)
			{
				var sdk = $('#iphone_device_sdk').val();
				var type = (PackageProject.currentProject.type=='mobile') ? 'iphone' : PackageProject.currentProject.type;				
				Titanium.Analytics.featureEvent(type+'.install',{sdk:sdk,guid:PackageProject.currentProject.guid,devName:devName,appid:PackageProject.currentProject.appid,name:PackageProject.currentProject.name});
				var x = TiDev.launchPython([Titanium.Filesystem.getFile(PackageProject.iPhoneEmulatorPath).toString(),'install','"'+sdk+'"', '"'+ PackageProject.currentProject.dir+ '"',PackageProject.currentProject.appid, '"' + PackageProject.currentProject.name+ '"','"'+uuid+'"', '"'+devName + '"', deviceFamily]);
				var buffer = '';
				x.setOnRead(function(event)
				{
					var row = event.data.toString();
					var errorIndex = row.indexOf('[ERROR]')
					if (errorIndex != -1 && row.indexOf('** BUILD FAILED **') == -1)
					{
						buffer += row.substring(errorIndex).replace('[ERROR]','');
					}
				});
				x.setOnExit(function(event)
				{
					if (x.getExitCode() != 0)
					{
						alert('Install Error\n\n' + buffer);
					}
					TiDev.showDefaultSystemMessage()
				});
				x.launch();
			}
		});

		// handler iphone emulator start
		$('#mobile_emulator_iphone').click(function()
		{
			PackageProject.inConsoleMode = true;

			// set height
			$('#mobile_iphone_emulator_viewer').css('height','315px');
			$('#mobile_package_detail').css('height','427px');

			// set margin
			$('#mobile_package_detail').css('marginLeft','-4px');

			// set width
			$('#mobile_package_detail').css('width','auto');


			$('#packaging .tab.emulator').removeClass('active');
			$(this).addClass('active');
			
			$('#mobile_android_emulator_container').css('display','none');	
			$('#mobile_iphone_emulator_container').css('display','block');
			$('#mobile_device_detail').css('display','none');	
			$('#mobile_distribution_detail').css('display','none');	


			PackageProject.initializeConsoleWidth();
		});
		
		//
		// Change simulator device
		//
		$('#iphone_simulator_device').change(function()
		{
			var x = TiDev.launchPython([Titanium.Filesystem.getFile(PackageProject.iPhonePrereqPath).toString(), 'project']);
			x.setOnRead(function(event)
			{
				try
				{
					var d = event.data.toString();
					var json = swiss.evalJSON(d);
					if (json.sdks)
					{
						var html = '';
						for(var i=0;i<json.sdks.length;i++)
						{
							if ($('#iphone_simulator_device').val() == 'ipad')
							{
								// ipad-only is supported with 3.2 and 4.2+
								if (json.sdks[i].substring(0,3) == '3.2' || 
									(parseInt(json.sdks[i][0]) == 4 && parseInt(json.sdks[i][2]) >= 2) ||
									(parseInt(json.sdks[i][0]) > 4))
								{
									html += '<option value="'+json.sdks[i]+'">'+json.sdks[i] + '</option>';
								}
							}
							else
							{
								if (json.sdks[i].substring(0,3) != '3.2') {
									html += '<option value="'+json.sdks[i]+'">'+json.sdks[i] + '</option>';
								}
							}
						}
						$('#iphone_emulator_sdk').html(html);
					}
				}
				catch (e)
				{
				}
			});
			x.launch();
		});

		// 
		// Launch emulator
		//
		$('#iphone_launch_button').click(function()
		{
			if ($(this).hasClass('disabled'))return;
			
			$(this).addClass('disabled');
			$('#iphone_kill_button').removeClass('disabled');
			
			// clear viewer
			$('#mobile_iphone_emulator_viewer').empty();

			PackageProject.inConsoleMode = true;
			
			var sdk = $('#iphone_emulator_sdk').val();
			var type = (PackageProject.currentProject.type=='mobile') ? 'iphone' : PackageProject.currentProject.type;
			var simDevice = $('#iphone_simulator_device').val();
			if (type == 'ipad')
			{
				// Coerce simDevice to ipad for ipad projects
				simDevice = 'ipad';
			}
			
			Titanium.Analytics.featureEvent(type+'.simulator',{sdk:sdk,appid:PackageProject.currentProject.appid,name:PackageProject.currentProject.name,guid:PackageProject.currentProject.guid});
			
			// kill if still running
			if (PackageProject.currentIPhonePID != null)
			{
				PackageProject.currentIPhonePID.terminate();
				PackageProject.currentIPhonePID = null;
				PackageProject.iphoneEmulatorStartDate = null;
			}
			
			PackageProject.mobileCompile(Titanium.Filesystem.getFile(PackageProject.currentProject.dir,"Resources").nativePath(),'iphone',function()
			{
				PackageProject.currentIPhonePID = TiDev.launchPython([Titanium.Filesystem.getFile(PackageProject.iPhoneEmulatorPath).toString(),'simulator', '"'+sdk+'"','"'+ PackageProject.currentProject.dir+ '"',PackageProject.currentProject.appid, '"' + PackageProject.currentProject.name+ '"', deviceFamily, simDevice]);
				PackageProject.logReader(PackageProject.currentIPhonePID,'iphone','simulator');
				PackageProject.iphoneEmulatorStartDate = new Date();
				PackageProject.currentIPhonePID.setOnExit(function(event)
				{
					Titanium.Analytics.timedEvent('iphone.simulator',PackageProject.iphoneEmulatorStartDate, new Date(),null,{guid:PackageProject.currentProject.guid});
					PackageProject.iphoneEmulatorStartDate = null;
					PackageProject.currentIPhonePID = null;
					$('#iphone_launch_button').removeClass('disabled');
					$('#iphone_kill_button').addClass('disabled');
					PackageProject.removeReaderProcess('iphone','simulator');
				});
				PackageProject.currentIPhonePID.launch();
			});
			
		});
		
		// create emulator buttons
		TiUI.GreyButton({id:'iphone_launch_button'});
		TiUI.GreyButton({id:'iphone_kill_button'});

		// show emulator tab and configure listeners
		// activate android tab if not osx
		if (Titanium.platform == "osx")
		{
			$('#mobile_emulator_iphone').css('display','block');
			$('#mobile_emulator_iphone').click();
		}

		$('#iphone_kill_button').click(function()
		{
			if ($(this).hasClass('disabled'))return;
			
			if (PackageProject.currentIPhonePID != null)
			{
				PackageProject.currentIPhonePID.terminate();
				PackageProject.currentIPhonePID = null;
				$(this).addClass('disabled');
				$('#iphone_launch_button').removeClass('disabled');
				
			}
		});
	}
	else
	{
		// otherwise setup non-iphone state
		$('#mobile_emulator_iphone').css('display','none');
		$('#mobile_emulator_iphone').removeClass('active');
	
		$('.project_has_iphone_true').css('display','none');
		$('.project_has_iphone_false').css('display','block');

	}
	// check project for android
	if (PackageProject.currentProject.platforms.android == true)
	{
		var buildpath = Titanium.Filesystem.getFile(PackageProject.currentProject.dir,'build','android');
		if (buildpath.exists() != true)
		{
			buildpath.createDirectory();
		}
		// if we don't have the android sdk dir, get it
		if (TiDev.androidSDKDir == null)
		{
			TiDev.androidSDKDir = Projects.getAndroidSDKLoc();
			if (TiDev.androidSDKDir == null)
			{
				alert('You need to specify your Android SDK location!\nPlease go to the Edit Profile tab under the Profile perspective to set this value.')
				return;
			}
		}
		
		var avdPath = Titanium.Filesystem.getFile(PackageProject.AndroidAvdPath);
		
		// if we have the avd script then show fields and get version info
		if (avdPath.exists())
		{
			PackageProject.sendAVD = true;

			// hide these two for now
			$('#android_version_container').css('display','none');
			$('#android_version_device_container').css('display','none');
			
			// show for emulator only
			$('#android_emulator_sdk_container').css('display','block');
			$('#android_emulator_skins_container').css('display','block');			
			
			var args = [avdPath.toString(),'"' + TiDev.androidSDKDir + '"'];
			var avd = TiDev.launchPython(args);
			avd.setOnRead(function(event)
			{
				try
				{
					var d = event.data.toString();
					PackageProject.androidSDKs = swiss.evalJSON(d);
					
					
					// create select HTML for version
					var versions = '';
					var verObj = PackageProject.getAndroidVersion();
					var selSkin= null;
					var selVer = null;
					if (verObj != null)
					{
						selSkin = verObj.skin;
						selVer = verObj.version;
					}
					for (var i=0;i<PackageProject.androidSDKs.length;i++)
					{
						var name = PackageProject.androidSDKs[i].name.replace('Android','');
						name = name.replace('Google','');

						if (selVer != null && selVer == PackageProject.androidSDKs[i].id)
						{
							versions += '<option value="'+PackageProject.androidSDKs[i].id+'" selected>'
								+name + '</option>';
						}
						else
						{
							versions += '<option value="'+PackageProject.androidSDKs[i].id+'">'
								+name+ '</option>';						
						}
					}

					// set differnt version selects
					$('#android_version').html(versions);
					$('#android_version_device').html(versions);
					$('#android_emulator_sdk').html(versions);

					var tmpVersion = 0;
					if (selVer!=null && selVer != '')
					{
						var intVer = parseInt(selVer);
						if (intVer == 0)return;
						else tmpVersion = intVer - 1;
					}

					// set skins initially
					$('#android_emulator_skins').html(setSkins(tmpVersion));

					// version change handlder 1
					$('#android_emulator_sdk').change(function(e)
					{
						var el = $(this).get(0);
						selVer = el.selectedIndex;
						$('#android_emulator_skins').html(setSkins(el.selectedIndex));

						// persist value
						PackageProject.saveAndroidVersion($(this).val(), $('#android_emulator_skins').val());
					});
					// version change handlder 2
					$('#android_version').change(function(e)
					{
						// persist value
						PackageProject.saveAndroidVersion($(this).val(),$('#android_emulator_skins').val());
					});
					// version change handlder 3
					$('#android_version_device').change(function(e)
					{
						// persist value
						PackageProject.saveAndroidVersion($(this).val(),$('#android_emulator_skins').val());
					});
					// version change handlder 3
					$('#android_emulator_skins').change(function(e)
					{
						// persist value
						PackageProject.saveAndroidVersion($('#android_emulator_sdk').val(),$(this).val());
						selSkin = $(this).val();
					});

					function setSkins(id)
					{
						var skins = '';
						for (var i=0;i<PackageProject.androidSDKs[id].skins.length;i++)
						{
							if (selSkin != null && selSkin == PackageProject.androidSDKs[id].skins[i])
							{
								skins += '<option value="'+PackageProject.androidSDKs[id].skins[i]+'" selected>'
									+PackageProject.androidSDKs[id].skins[i] + '</option>';
							}
							else
							{
								skins += '<option value="'+PackageProject.androidSDKs[id].skins[i]+'">'
									+PackageProject.androidSDKs[id].skins[i] + '</option>';

							}
						}
						return skins;
					};

				}
				catch (e)
				{
					// do nothing
				}
				
			});
			avd.launch();
		}
		else
		{
			PackageProject.sendAVD = false;
			
			// hide version fields
			$('#android_version_container').css('display','none');
			$('#android_version_device_container').css('display','none');
			$('#android_emulator_sdk_container').css('display','none');
			$('#android_emulator_skins_container').css('display','none');			
		}
			
		
		// setup proper "device" view
		$('.project_has_android_true').css('display','block');
		$('.project_has_android_false').css('display','none');
		
		// setup device button
		TiUI.GreyButton({id:'android_install_on_device_button'});
		$('#android_install_on_device_button').click(function()
		{
			TiDev.setConsoleMessage('Installing app on device...');
			Titanium.Analytics.featureEvent('android.install',{name:PackageProject.currentProject.name,appid:PackageProject.currentProject.appid,guid:PackageProject.currentProject.guid});
			var sdkId = $('#android_version_device').val();			
			var args = [Titanium.Filesystem.getFile(PackageProject.AndroidEmulatorPath).toString(), "install", '"'+ PackageProject.currentProject.name+ '"','"' +TiDev.androidSDKDir+ '"', '"' + PackageProject.currentProject.dir + '"', '"'+PackageProject.currentProject.appid+'"', '"'+sdkId+'"'];

		 	var installAndroid = TiDev.launchPython(args);
			var buffer = '';

			installAndroid.setOnRead(function(event)
			{
				var row = event.data.toString();
				if (row.indexOf('[ERROR]') != -1 && row.indexOf('** BUILD FAILED **') == -1)
				{
					buffer+= row.replace('[ERROR]','');
				}
			});
			installAndroid.setOnExit(function(event)
			{
				TiDev.messageArea.showDefaultMessage();

				if (installAndroid.getExitCode() != 0)
				{
					alert('Install Error\n\n' + buffer);
				}
			});
			installAndroid.launch();
		});

		// keystore location
		$('#android_key_store_location').click(function()
		{
			var props = {multiple:false,directories:false,files:true};
			Titanium.UI.currentWindow.openFileChooserDialog(function(f)
			{
				if (f.length)
				{
					// set file and revalidate
					$('#android_key_store').val(f[0]);
					androidPackageValidator();
				}
			},
			props);						
		});

		// distribution location
		$('#android_location_folder').click(function()
		{
			var props = {multiple:false,directories:true,files:false};
			Titanium.UI.currentWindow.openFolderChooserDialog(function(f)
			{
				if (f.length)
				{
					// set file and revalidate
					$('#android_location').val(f[0]);
					androidPackageValidator();
				}
			},
			props);						
		});
		
		TiUI.GreyButton({id:'android_package_button'});
		$('#android_package_button').click(function()
		{
			if ($(this).hasClass('disabled')) return true;
			TiDev.setConsoleMessage('Creating Android distribution...');
			var location = $('#android_location').val();
			var keystore = $('#android_key_store').val();
			var password = $('#android_key_store_password').val();
			var alias = $('#android_alias').val();
			var sdkId = $('#android_version').val();		
			if (PackageProject.sendAVD==false)
			{
				var args = [Titanium.Filesystem.getFile(PackageProject.AndroidEmulatorPath).toString(), "distribute", '"'+ PackageProject.currentProject.name+ '"','"' +TiDev.androidSDKDir+ '"', '"' + PackageProject.currentProject.dir + '"', '"'+PackageProject.currentProject.appid+'"','"'+keystore+'"','"'+password+'"','"'+alias+'"', '"'+location+'"'];
			}	
			else
			{
				var args = [Titanium.Filesystem.getFile(PackageProject.AndroidEmulatorPath).toString(), "distribute", '"'+ PackageProject.currentProject.name+ '"','"' +TiDev.androidSDKDir+ '"', '"' + PackageProject.currentProject.dir + '"', '"'+PackageProject.currentProject.appid+'"','"'+keystore+'"','"'+password+'"','"'+alias+'"', '"'+location+'"', '"'+sdkId+'"'];
			}
		 	var  x = TiDev.launchPython(args);
			var buffer = '';
			x.setOnRead(function(event)
			{
				var row = event.data.toString();
				if (row.indexOf('[ERROR]') != -1 && row.indexOf('** BUILD FAILED **') == -1)
				{
					buffer+= row.replace('[ERROR]','');
				}
			});
			x.setOnExit(function(event)
			{
				TiDev.messageArea.showDefaultMessage();
				if (x.getExitCode() != 0)
				{
					alert('Packaging Error\n\n' + buffer);
				}
			});
			x.launch();
				
			Titanium.Analytics.featureEvent('android.distribute',{name:PackageProject.currentProject.name,guid:PackageProject.currentProject.guid,appid:PackageProject.currentProject.appid});
			
		});

		// packaging validation
		var androidPackageValidator = TiUI.validator('android_package',function(valid)
		{
			if (valid) 
				$('#android_package_button').removeClass('disabled');
			else
				$('#android_package_button').addClass('disabled');
		});
		
		// handle android emulator start
		$('#mobile_emulator_android').click(function()
		{
			PackageProject.inConsoleMode = true;

			// set height
			$('#mobile_android_emulator_viewer').css('height','315px');
			$('#mobile_package_detail').css('height','427px');

			// set margin
			$('#mobile_package_detail').css('marginLeft','-4px');

			// set width
			$('#mobile_package_detail').css('width','auto');

			// clear viewer
			$('#mobile_android_emulator_viewer').empty();

			$('#packaging .tab.emulator').removeClass('active');
			$(this).addClass('active');

			$('#mobile_iphone_emulator_container').css('display','none');
			$('#mobile_android_emulator_container').css('display','block');	
			$('#mobile_device_detail').css('display','none');	
			$('#mobile_distribution_detail').css('display','none');	
			$('#mobile_help_detail').css('display','none');
			
			PackageProject.initializeConsoleWidth();
		});

		// activate android tab if not osx
		if (Titanium.platform != "osx")
		{
			$('#mobile_emulator_android').click();
		}
		// setup emulator buttons
		TiUI.GreyButton({id:'android_kill_button'});
		TiUI.GreyButton({id:'android_launch_button'});

		// setup emulator handlers and show tab
		$('#mobile_emulator_android').css('display','block');

		// TiUI.GreyButton({id:'android_clear_button'});
		// $('#android_clear_button').click(function()
		// {
		// 	$('#mobile_android_emulator_viewer').empty();
		// });	

		$('#android_kill_button').click(function()
		{
			if ($(this).hasClass('disabled'))return;
			
			if (PackageProject.currentAndroidEmulatorPID != null)
			{
				if (PackageProject.currentAndroidPID != null)
				{
					PackageProject.currentAndroidPID.terminate();
					PackageProject.currentAndroidPID = null;
				}
				
				PackageProject.currentAndroidEmulatorPID.terminate();
				PackageProject.currentAndroidEmulatorPID = null;
				
				// reset state
				PackageProject.isAndroidEmulatorRunning  = false;

				$(this).addClass('disabled')
			}
		});
		
		$('#android_launch_button').click(function()
		{
			if ($(this).hasClass('disabled'))return;
			
			Titanium.Analytics.featureEvent('android.simulator',{name:PackageProject.currentProject.name,appid:PackageProject.currentProject.appid,guid:PackageProject.currentProject.guid});
			
			$('#android_kill_button').removeClass('disabled');

			PackageProject.inConsoleMode = true;
			
			$('#mobile_android_emulator_viewer').empty();
			
			// function for filtering android output
			function androidLogFilter(str)
			{
				var b = str.charAt(0);
				if (b == '[') return str;
				
				// check to see if android log output
				// see if our Titanium logger
				if (str.indexOf('/TiAPI ')!=-1)
				{
					var i = str.indexOf(') ');
					var s = str.substring(i+2);
					switch(b)
					{
						case 'E':
						{
							return '[ERROR] '+s;
						}
						case 'W':
						{
							return '[WARN] '+s;
						}
						case 'I':
						{
							return '[INFO] '+s;
						}
						case 'D':
						{
							return '[DEBUG] '+s;
						}
					}
				}
				
				// assume it's just trace output from simulator
				return '[TRACE] ' + str;
			}
			// install an android app
			function installAndroidApp()
			{
				var sdkId = $('#android_emulator_sdk').val();		
				var skin = $('#android_emulator_skins').val();	
				var args = [Titanium.Filesystem.getFile(PackageProject.AndroidEmulatorPath).toString(), "simulator", '"'+ PackageProject.currentProject.name+ '"','"' +TiDev.androidSDKDir+ '"', '"' + PackageProject.currentProject.dir + '"', '"'+PackageProject.currentProject.appid+'"', '"'+sdkId+'"', '"'+skin+'"'];
				PackageProject.currentAndroidPID = TiDev.launchPython(args);
				PackageProject.currentAndroidPID.setOnExit(function(event)
				{
					PackageProject.removeReaderProcess('android','simulator');
					PackageProject.currentAndroidPID = null;
				});
				PackageProject.logReader(PackageProject.currentAndroidPID,'android','simulator',androidLogFilter);
				PackageProject.currentAndroidPID.launch();
			};
		
			PackageProject.initializeConsoleWidth();
			
			// first see if emulator is running
			if (PackageProject.isAndroidEmulatorRunning == false)
			{
				var sdkId = $('#android_emulator_sdk').val();		
				var skin = $('#android_emulator_skins').val();	
				PackageProject.isAndroidEmulatorRunning = true;
				PackageProject.androidEmulatorStartDate = new Date();
				var args = [Titanium.Filesystem.getFile(PackageProject.AndroidEmulatorPath).toString(), "emulator", '"'+ PackageProject.currentProject.name+ '"','"' +TiDev.androidSDKDir+ '"', '"' + PackageProject.currentProject.dir + '"', '"'+PackageProject.currentProject.appid+'"', '"'+sdkId+'"', '"'+skin+'"'];
				PackageProject.currentAndroidEmulatorPID = TiDev.launchPython(args);
				
				PackageProject.currentAndroidEmulatorPID.setOnExit(function(event)
				{
					Titanium.Analytics.timedEvent('android.simulator',PackageProject.androidEmulatorStartDate, new Date(),null,{guid:PackageProject.currentProject.guid});
					PackageProject.androidEmulatorStartDate = null;
					PackageProject.currentAndroidEmulatorPID = null;
					PackageProject.isAndroidEmulatorRunning = false;
					PackageProject.removeReaderProcess('android','emulator');
					$('#android_kill_button').addClass('disabled');
				});
				
				PackageProject.logReader(PackageProject.currentAndroidEmulatorPID,'android','emulator',androidLogFilter);
				PackageProject.currentAndroidEmulatorPID.launch();
				setTimeout(installAndroidApp,10000);
			}
			else
			{
				installAndroidApp();
			}
			
		});
		
		// initialize tab
		if ($('.project_has_iphone_true').css('display') == 'none')
		{
			$('#mobile_emulator_android').click();
		}
		
		
	}
	else
	{
		// otherwise show non-android view
		$('#mobile_emulator_android').css('display','none');
		$('.project_has_android_true').css('display','none');
		$('.project_has_android_false').css('display','block');
		
	}

	
	
	// handle install on device click
	$('#mobile_device').click(function()
	{
		PackageProject.inConsoleMode = false;

		// show right view
		$('#mobile_emulator_container').css('display','none');
		$('#mobile_distribution_detail').css('display','none');	
		$('#mobile_device_detail').css('display','block');	

		$('#mobile_package_detail').css('marginLeft','-4px');
		$('#mobile_package_detail').css('width','auto');
		
		// set classes
		$('#packaging .option').removeClass('active');
		$(this).addClass('active');
		
		$("#mobile_ads").html(TiDev.mobileDeviceContent)
		
		PackageProject.initializeConsoleWidth();
	});
	

	
	// handle install on device click
	$('#mobile_package').click(function()
	{
		PackageProject.inConsoleMode = false;
		
		// show right view
		$('#mobile_emulator_container').css('display','none');
		$('#mobile_device_detail').css('display','none');	
		$('#mobile_distribution_detail').css('display','block');	
		
		$('#mobile_package_detail').css('marginLeft','-4px');
		$('#mobile_package_detail').css('width','auto');
		
		// set classes
		$('#packaging .option').removeClass('active');
		$(this).addClass('active');
		
		$("#mobile_ads").html(TiDev.mobilePackageContent)
		
		PackageProject.initializeConsoleWidth();
	});
	
	// setup ipad UI
	if (PackageProject.currentProject.type == 'ipad' || 
		PackageProject.currentProject.type == 'universal')
	{
		$('#tab_iphone_dev').css('display','none');
		$('#tab_android_dev').css('display','none');
		$('#tab_iphone_package').css('display','none');
		$('#tab_android_package').css('display','none');
		$('#mobile_emulator_iphone').css('display','none');
		$('#mobile_emulator_android').css('display','none');
		// Don't display device selection if iPad; it's always iPad
		if (PackageProject.currentProject.type == 'ipad')
		{
			$('#iphone_simulator_device_container').css('display','none');
		}
		$('.tab_spacing').css('display', 'block');
		$('#mobile_emulator_iphone').click();
		$('#tab_iphone_dev').click();
		$('#tab_iphone_package').click();
	}
};


//
// check iphone dev prereqs - enable/disable button based on this
//
PackageProject.checkIPhoneDevPrereqs = function()
{
	if ($('#iphone_device_sdk').val() == '3.0')
	{
		if (PackageProject.iPhoneDevPrereqs['itunes'] == true &&
			PackageProject.iPhoneDevPrereqs['wwdr'] == true &&
			PackageProject.iPhoneDevPrereqs['iphone_dev'] == true &&
			PackageProject.iPhoneDevPrereqs['iphone_dev_profile'] == true)
		{
			$('#iphone_install_on_device_button').removeClass('disabled');
		}
		else
		{
			$('#iphone_install_on_device_button').addClass('disabled');
		}
	}
	else
	{
		if (PackageProject.iPhoneDevPrereqs['wwdr'] == true &&
			PackageProject.iPhoneDevPrereqs['iphone_dev'] == true &&
			PackageProject.iPhoneDevPrereqs['iphone_dev_profile'] == true)
		{
			$('#iphone_install_on_device_button').removeClass('disabled');
		}
		else
		{
			$('#iphone_install_on_device_button').addClass('disabled');
		}
	}
	PackageProject.iPhoneDistValidator();
};

//
// check iphone dist prereqs - enable/disable button based on this
//
PackageProject.checkIPhoneDistPrereqs = function()
{
	if (PackageProject.iPhoneDevPrereqs['itunes'] == true &&
		PackageProject.iPhoneDevPrereqs['wwdr'] == true &&
		PackageProject.iPhoneDevPrereqs['iphone_dist'] == true &&
		PackageProject.iPhoneDevPrereqs['iphone_dist_profile'] == true)
	{
		$('#iphone_package_button').removeClass('disabled');
	}
	else
	{
		$('#iphone_package_button').addClass('disabled');
	}
	PackageProject.iPhoneDistValidator();
};

//
// update provisioning profile select
//
PackageProject.updateProvisioningSelect = function(id,data,selected)
{
	var html = ''
	if (selected == null || data.length ==0)
	{
		html += '<option value="" selected>Select provisioning profile</option>';		
	}

	for (var i=0;i<data.length;i++)
	{
		if (data[i].uuid == selected)
		{
			html += '<option value="'+data[i].appid+'" selected>'+data[i].appid+ ' ('+data[i].name+') uuid:'+data[i].uuid+'</option>';		
		}
		else
		{
			html += '<option value="'+data[i].appid+'">'+data[i].appid+ ' ('+data[i].name+') uuid:'+data[i].uuid+'</option>';		
		}
	}
	$('#'+id).html(html);
};

//
// Add iphone attribute
//
PackageProject.setIPhoneAttribute = function(key,value)
{
	var curVal = PackageProject.getIPhoneAttribute(key);
	if (curVal == null)
	{
		// insert 
		TiDev.db.execute('INSERT INTO IPHONE_ATTRIBUTES (ID, NAME, VALUE) VALUES (?,?,?)', 
			PackageProject.currentProject.id, key,value);
	}
	else
	{
		// update project
		TiDev.db.execute('UPDATE IPHONE_ATTRIBUTES SET VALUE = ? WHERE ID = ? AND NAME = ?',value, 
			PackageProject.currentProject.id, key);
	}
};

//
// get an iphone attribute by key
//
PackageProject.getIPhoneAttribute = function(key)
{
	var rows = TiDev.db.execute('SELECT * FROM IPHONE_ATTRIBUTES WHERE id = ? and NAME = ?',PackageProject.currentProject.id,key);
	while (rows.isValidRow())
	{
		return rows.fieldByName('VALUE');
	}
	return null;
};

//
// Update APP ID
//
PackageProject.updateMobileAppId = function(appid)
{
	if (appid.indexOf('*') != -1)
	{
		var regex = new RegExp('^' +  appid.substring(0,appid.length-1)) 
		if (regex.test(PackageProject.currentProject.appid)==false)
		{
			appid = appid.substring(0,appid.length-1) + PackageProject.currentProject.name;
			TiDev.db.execute('UPDATE PROJECTS set appid = ? WHERE id = ?', appid, PackageProject.currentProject.id);
			PackageProject.currentProject.appid = appid;
		}
	}
	// if no * update to full appid
	else
	{
		TiDev.db.execute('UPDATE PROJECTS set appid = ? WHERE id = ?', appid, PackageProject.currentProject.id);
		PackageProject.currentProject.appid = appid;
	}
};

//
// Show file dialog for upload new provisioning profile
//
PackageProject.uploadIPhoneProvisioningProfile = function(profileType,callback)
{
	var props = {multiple:false,types:['mobileprovision']};
	Titanium.UI.openFileChooserDialog(function(f)
	{
		if (f.length)
		{
			TiDev.setConsoleMessage('Loading new provisioning profile...');
			
		 	var x= TiDev.launchPython([Titanium.Filesystem.getFile(PackageProject.iPhoneProvisioningPath).toString(),'"'+f[0]+'"']);
			x.setOnRead(function(event)
			{
				var d = event.data.toString();
				var json = swiss.evalJSON(d);
				var appid = json['appid'];
				var type = (profileType =='distribution_profile')?'distribution':'development';
				var name = json['name'];
				var uuid = json['uuid']
				if (name && type && appid)
				{
					// add record to profile db
					PackageProject.addIPhoneProvisioningProfile(appid,f[0],type,name,uuid);
					
					// update appid
					PackageProject.updateMobileAppId(appid);
					
					var uuidString = (profileType =='distribution_profile')?'dist_uuid':'dev_uuid';

					// update current active
					PackageProject.setIPhoneAttribute(profileType,appid);
					PackageProject.setIPhoneAttribute(uuidString,uuid);

					callback({result:true,appid:appid,uuid:uuid});
					
				}
				else
				{
					callback({result:false});
				}
			});
			x.launch();
		}
	},
	props);
};

//
// Add a iphone provisioning profile by type (developer | distribution)
//
PackageProject.addIPhoneProvisioningProfile = function(appid,dir,type,name,uuid)
{
	TiDev.db.execute('INSERT INTO IPHONE_PROVISIONING_PROFILES (appid, directory, type,name,uuid) VALUES(?,?,?,?,?)',appid,dir,type,name,uuid);
};

//
// Remove a iphone provisioning profile by type (developer | distribution)
//
PackageProject.removeIPhoneProvisioningProfile = function(type,uuid)
{
	TiDev.db.execute('DELETE FROM IPHONE_PROVISIONING_PROFILES WHERE type=? AND uuid=?',type,uuid);
};

//
// Get a list of iphone provisioning profiles by type (developer | distribution)
//
PackageProject.getIPhoneProvisioningProfiles = function(type)
{
	var profiles = [];
	try
	{
		var dbrows = TiDev.db.execute('SELECT * FROM IPHONE_PROVISIONING_PROFILES WHERE type = ?', type);
		while (dbrows.isValidRow())
		{
			profiles.push({appid:dbrows.fieldByName('APPID'), name:dbrows.fieldByName('NAME'), uuid:dbrows.fieldByName('UUID')});
			dbrows.next();
		}
		return profiles;
	}
	catch(e)
	{
		TiDev.db.execute('CREATE TABLE IPHONE_PROVISIONING_PROFILES (APPID TEXT, DIRECTORY TEXT, TYPE TEXT, NAME TEXT, UUID TEXT)');
		return profiles;
	}
};

//
// Setup display for desktop project
//
PackageProject.setupDesktopView = function()
{
	// show correct view
	$('#mobile_packaging').css('display','none');
	$('#desktop_packaging').css('display','block');

	// initialize launch view
	$('#desktop_launch_viewer').css('height','347px');
	$('#desktop_package_detail').css('height','420px');
	$('#desktop_launch_detail').css('display','block');
	$('#desktop_package_detail').css('marginLeft','-4px');

	// setup desktop ad
	$('#desktop_ads').html(TiDev.desktopLaunchContent);
	
	// setup option handlers
	$('.optiongroup').click(function()
	{
		var id = $(this).get(0).id;
		switch (id)
		{
			case 'linux_packaging':
			case 'win_packaging':
			case 'mac_packaging':
			{
				if ($(this).hasClass('active_option'))
				{
					$(this).removeClass('active_option');
				}
				else
				{
					$(this).addClass('active_option');
				}
				break;
			}
			case 'public_packaging':
			{
				$(this).addClass('active_option');
				$('#private_packaging').removeClass('active_option');
				break;
			}
			case 'private_packaging':
			{
				$(this).addClass('active_option');
				$('#public_packaging').removeClass('active_option');
				break;
			}
			case 'network_packaging':
			{
				$(this).addClass('active_option');
				$('#bundled_packaging').removeClass('active_option');
				break;
			}
			case 'bundled_packaging':
			{
				$(this).addClass('active_option');
				$('#network_packaging').removeClass('active_option');
				break;
			}
			case 'release_yes_packaging':
			{
				$(this).addClass('active_option');
				$('#release_no_packaging').removeClass('active_option');
				break;
			}
			case 'release_no_packaging':
			{
				$(this).addClass('active_option');
				$('#release_yes_packaging').removeClass('active_option');
				break;
			}

		}
	});
	
	// setup buttons
	TiUI.GreyButton({id:'launch_kill_button'});
	TiUI.GreyButton({id:'launch_app_button'});

	TiUI.GreyButton({id:'desktop_package_button'});


	$('#launch_kill_button').click(function()
	{
		if ($(this).hasClass('disabled'))return;

		if (PackageProject.currentAppPID != null)
		{
			PackageProject.currentAppPID.terminate();
			PackageProject.currentAppPID = null;
			$('#launch_kill_button').addClass('disabled');
			$('#launch_app_button').removeClass('disabled');
		}
	});
	$('#desktop_package_button').click(function()
	{		
		if ($(this).hasClass('disabled')) return;
	
		var osSelected =false
		$('.operating_system').each(function()
		{
			if ($(this).hasClass('active_option'))
			{
				osSelected=true;
			}
		});

		if (osSelected==false)
		{
			alert('You must select at least one operating system.');
			return;
		}
		
		
		$(this).addClass('disabled');
		
		// set margin
//		$('#desktop_package_detail').css('marginLeft','-21px');

		// write out manifest
		Titanium.Project.writeManifest(PackageProject.currentProject);
		
		// write out timanifest 
		PackageProject.writeTiManifest(PackageProject.currentProject);
		
		// copy files to be published
		PackageProject.copyAppFiles(PackageProject.currentProject, function(r)
		{
			// publish app
			if (r.dir != null)
			{
				PackageProject.publishDesktopApp(r.dir, PackageProject.currentProject);
			}
			else
			{
				TiDev.setConsoleMessage('Unexpected error, message: ' + r.error, 5000);
			}
		});
	});
	
	// setup desktop launch handler
	$('#desktop_launch').click(function()
	{
		// set height
		$('#desktop_launch_viewer').css('height','347px');
		$('#desktop_package_detail').css('height','420px');

		// set margin
		$('#desktop_package_detail').css('marginLeft','-4px');

		PackageProject.inConsoleMode = true;

		// set classes
		$('#packaging .active').removeClass('active');
		$(this).addClass('active');

		// set display
		$('#desktop_packaging_options').css('display','none');
		$('#desktop_links_detail').css('display','none');
		$('#desktop_launch_detail').css('display','block');

		$('#desktop_ads').html(TiDev.desktopLaunchContent);
		
		PackageProject.initializeConsoleWidth();
		
	});
	
	//
	// launch desktop app
	//
	$('#launch_app_button').click(function()
	{
		if ($(this).hasClass('disabled'))return;
		
		$('#launch_app_button').addClass('disabled');
		$('#launch_kill_button').removeClass('disabled');
		
		if (PackageProject.currentAppPID == null)
		{
			// clear viewer
			$('#desktop_launch_viewer').empty();

			PackageProject.initializeConsoleWidth();
			
			// set desktop packaging path
			var runtime = PackageProject.currentProject.runtime;
			var sdk = Titanium.Project.getSDKVersions(runtime);
			PackageProject.desktopPackage = Titanium.Filesystem.getFile(sdk.getPath(),'tibuild.py');
			var dest = Titanium.Filesystem.getFile(PackageProject.currentProject.dir,'dist',Titanium.platform);
			if (dest.exists()==false)
			{
				dest.createDirectory(true);
			}
			var sdkDir = Titanium.Filesystem.getFile(sdk.getPath());
			var basePath = Titanium.Filesystem.getFile(sdkDir,".." + Titanium.Filesystem.getSeparator(),".." + Titanium.Filesystem.getSeparator(),".." + Titanium.Filesystem.getSeparator());
			var assets = Titanium.Filesystem.getFile(sdk.getPath());
			var appdir = Titanium.Filesystem.getFile(PackageProject.currentProject.dir);

			// write out new manifest based on current modules
			Titanium.Project.writeManifest(PackageProject.currentProject);

			Titanium.Analytics.featureEvent('desktop.launch',{sdk:runtime,appid:PackageProject.currentProject.appid,name:PackageProject.currentProject.name,guid:PackageProject.currentProject.guid});
			PackageProject.desktopAppLaunchDate = new Date();
			
			// launch desktop app
			PackageProject.currentAppPID = TiDev.launchPython(
				[PackageProject.desktopPackage.toString(),
				"-d", dest.toString(), // Staging directory
				"-a", assets.toString(), // Assets path
				"-n", // Don't include the installer
				"-r", // Run it!
				"-v", // Verbose
				"-s", basePath.toString(), // SDK path
				appdir.toString()]);
			
		 	$('#desktop_launch_viewer').append('<div style="margin-bottom:3px">Preparing to package and launch desktop app. One moment...</div>');
			console.log("process="+PackageProject.currentAppPID);
			var buf = '';
			PackageProject.currentAppPID.setOnRead(function(event)
			{
				buf += event.data.toString();
				var idx = buf.indexOf('\n');
				while (idx!=-1)
				{
					var str = buf.substring(0,idx);
					$('#desktop_launch_viewer').append('<div style="margin-bottom:3px">'+ str + '</div>');
					$('#desktop_launch_viewer').get(0).scrollTop = $('#desktop_launch_viewer').get(0).scrollHeight;
					if (idx+1 < buf.length)
					{
						buf = buf.substring(idx+1);
						idx = buf.indexOf('\n');
					}
					else
					{
						buf = '';
						break;
					}
				}
			});
			PackageProject.currentAppPID.setOnExit(function(event)
			{
				Titanium.Analytics.timedEvent('desktopapp.launch',PackageProject.desktopAppLaunchDate, new Date(),null,{guid:PackageProject.currentProject.guid});
				PackageProject.desktopAppLaunchDate = null;
				PackageProject.currentAppPID = null;
				$('#launch_kill_button').addClass('disabled');
				$('#launch_app_button').removeClass('disabled');
				
			});
			PackageProject.currentAppPID.launch();
		}
		
	});
	// setup desktop links handler
	$('#desktop_links').click(function()
	{
		$('#desktop_packaging_options').css('display','none');
		$('#desktop_launch_detail').css('display','none');
		$('#desktop_links_detail').css('display','block');

		PackageProject.inConsoleMode = false;

		
		// set classes
		$('#packaging .active').removeClass('active');
		$(this).addClass('active');

		$('#desktop_ads').html(TiDev.desktopLinksContent);
		
		Links.setPageData();
		PackageProject.initializeConsoleWidth();
	
	});

	// setup desktop package handler
	$('#desktop_package').click(function()
	{
		// set display
		$('#desktop_packaging_options').css('display','block');
		$('#desktop_launch_detail').css('display','none');
		$('#desktop_links_detail').css('display','none');

		PackageProject.inConsoleMode = false;
		
		// set margin
		$('#desktop_package_detail').css('marginLeft','-4px');
		
		// set classes
		$('#packaging .active').removeClass('active');
		$(this).addClass('active');

		$('#desktop_ads').html(TiDev.desktopPackageContent);

		PackageProject.initializeConsoleWidth();

	});
	
	
};


//
// set initial console width
//
PackageProject.initializeConsoleWidth = function()
{
	var windowWidth = Titanium.UI.currentWindow.getWidth();
	var windowHeight = Titanium.UI.currentWindow.getHeight();
	var leftWidth = $('#tiui_content_left').width();
	var rightWidth = windowWidth - leftWidth;	
	var height = $("#tiui_content_right").height() - 170;
	
	if (PackageProject.currentProject==null)return;
	// set container height
	if (PackageProject.currentProject.type == 'mobile' || 
		PackageProject.currentProject.type == 'ipad' ||
		PackageProject.currentProject.type == 'universal')
	{
		$(".detail").css('height',(height+94)+'px');
		$('.debug_console').css('width',(rightWidth-320) + 'px').css('height',(height - 26) + 'px');
	}
	else
	{
		$(".detail").css('height',(height+79)+'px');
		$('.debug_console').css('width',(rightWidth-320) + 'px').css('height',(height) + 'px');
	}

};

// resize console when the window resizes
window.onresize = PackageProject.initializeConsoleWidth;

// setup event handler
PackageProject.eventHandler = function(event)
{
	var listener = null;
	if (event == 'focus')
	{
		PackageProject.setupView();

	}
	else if (event == 'load')
	{
		PackageProject.setupView();
	}
};

//
// Write timanifest file
//
PackageProject.writeTiManifest = function(project)
{
	// make sure required files/dirs are present
	var resources = TFS.getFile(project.dir,'Resources');
	if (!resources.exists())
	{
		alert('Your project is missing the Resources directory.  This directory is required for packaging.');
		return;
	}
	var tiapp = TFS.getFile(project.dir,'tiapp.xml');
	if (!tiapp.exists())
	{
		alert('Your tiapp.xml file is missing.  This file is required for packaging.');
		return;
	}

	// get packaging options
	var networkRuntime = ($('#network_packaging').hasClass('active_option') ==true)?'network':'include';
	var releaseUpdates = ($('#release_yes_packaging').hasClass('active_option') ==true)?true:false;
	var visibility = ($('#public_packaging').hasClass('active_option')==true)?'public':'private';

	var timanifest = {};

	timanifest.appname = project.name;
	timanifest.appid = project.appid;
	timanifest.appversion = project.version;
	timanifest.mid = Titanium.Platform.id;
	timanifest.publisher = project.publisher;
	timanifest.url = project.url;
	timanifest.desc = project.description;
	timanifest.release = releaseUpdates;
	
	if (project.image)
	{
		var image = TFS.getFile(project.image);
		timanifest.image = image.name();
	}

	// OS options
	timanifest.platforms = [];
	var winTrue = false; linuxTrue = false; macTrue = false;
	if ($('#mac_packaging').hasClass('active_option'))
	{
		timanifest.platforms.push('osx');
		macTrue =true;
	}
	if ($('#win_packaging').hasClass('active_option'))
	{
		timanifest.platforms.push('win32');
		winTrue = true;
	}
	if ($('#linux_packaging').hasClass('active_option'))
	{
		timanifest.platforms.push('linux');
		linuxTrue = true;
	}
	Titanium.Analytics.featureEvent('desktop.package',{win:winTrue,linux:linuxTrue,mac:macTrue,guid:project.guid});

	timanifest.visibility = visibility;

	timanifest.runtime = {};
	timanifest.runtime.version = "" + project.runtime;
	timanifest.runtime.package = networkRuntime;

	timanifest.guid = project.guid;
	
	// see if analytics is enabled
	var hasAnalytics = Titanium.Project.hasAnalytics(project);
	
	if (project.type == 'desktop')
	{
		timanifest.modules = [];

		// required modules
		for (var i=0;i<Titanium.Project.requiredModules.length;i++)
		{
			// analytics disabled then ignore
			if (hasAnalytics==false && Titanium.Project.requiredModules[i].name == 'tianalytics')
			{
				continue;
			}

			var m = {};
			m.name = Titanium.Project.requiredModules[i].name;			
			m.version = "" + Titanium.Project.requiredModules[i].version;
			m.package = networkRuntime;
			timanifest.modules.push(m);
		}

		// write out optional modules
		for (var c=0;c<Titanium.Project.optionalModules.length;c++)
		{
			if (timanifest.appid != 'com.appcelerator.titanium.developer' && Titanium.Project.optionalModules[c].name.indexOf('sdk')!=-1)
				continue;

			var add = true;
			
			if (Titanium.Project.optionalModules[c].name == 'ruby')
			{
				if (project['languageModules'].ruby != 'on')
				{
					add = false;
				}
			}
			if (Titanium.Project.optionalModules[c].name == 'python')
			{
				if (project['languageModules'].python != 'on')
				{
					add = false;
				}
			}
			if (Titanium.Project.optionalModules[c].name == 'php')
			{
				if (project['languageModules'].php != 'on')
				{
					add = false;
				}
			}

			if (add ==true)
			{
				var m = {};
				m.name = Titanium.Project.optionalModules[c].name;			
				m.version = "" + Titanium.Project.optionalModules[c].version;
				m.package = networkRuntime;
				timanifest.modules.push(m);
			}
		}
	}
	else
	{
		timanifest['package_target'] = 'test';
	}

	var timanifestFile = TFS.getFile(project.dir,'timanifest');
	timanifestFile.write(swiss.toJSON(timanifest));
	
};

//
// Copy app files for packaging
//
PackageProject.copyAppFiles = function(project, callback)
{
	try
	{
		var resources = TFS.getFile(project.dir,'Resources');		
		var destDir = Titanium.Filesystem.createTempDirectory();
		var modules = TFS.getFile(project.dir,'modules');
		var timanifest = TFS.getFile(project.dir,'timanifest');
		var manifest = TFS.getFile(project.dir,'manifest');
		var tiapp = TFS.getFile(project.dir,'tiapp.xml');
		var changeLog = TFS.getFile(project.dir,'CHANGELOG.txt');
		var license = TFS.getFile(project.dir,'LICENSE.txt');

		var fileArray = [tiapp,timanifest,manifest];
		
		if (changeLog.exists())
		{
			fileArray.push(changeLog);
		}
		if (license.exists())
		{
			fileArray.push(license);
		}

		// copy files to temp dir
		var resDir = TFS.getFile(destDir,'Resources');
		resDir.createDirectory();

		TFS.asyncCopy(resources, resDir,function(path,currentIndex,total)
		{
			if (currentIndex==total)
			{
				TFS.asyncCopy(fileArray, destDir,function(path,currentIndex,total)
				{
					if (currentIndex==total)
					{
						// if project has modules, copy
						if (modules.exists())
						{
							// create resources dir
							var resDir = TFS.getFile(destDir,'modules');
							resDir.createDirectory();
							TFS.asyncCopy(modules, resDir,function(path,currentIndex,total)
							{
								if (currentIndex==total)
								{
									callback({dir:destDir});
								}
							});
						}
						else
						{
							callback({dir:destDir});
						}
					}
				});
			}
		});
	}
	catch (e)
	{
		callback({dir:null,error:e});
	}	
	
};

//
// Publish a desktop app
//
PackageProject.publishDesktopApp = function(destDir,project)
{
	// set packaging message
	TiDev.messageArea.setMessage(TiUI.progressBar.html('Packaging your app.  This may take a few...'));
	TiUI.progressBar.init();
	TiDev.messageArea.expand();				
	
	var url = Titanium.App.getStreamURL(PackageProject.publishURL);
	var data = {};
	data.sid = Projects.userSID;
	data.token = Projects.userToken;
	data.uid = Projects.userUID;
	data.uidt = Projects.userUIDT;

	url = TiDev.makeURL(url,data);
	var xhr = Titanium.Network.createHTTPClient();
	var ticket = null;
	xhr.onreadystatechange = function()
	{
		// 4 means that the POST has completed
		if (this.readyState == 4)
		{
			destDir.deleteDirectory(true);
			if (this.status == 200)
			{
				var json = swiss.evalJSON(this.responseText);
				if (json.success == false)
				{
					$('#desktop_package_button').removeClass('disabled');
					alert('Packaging failed. Error: ' + json.message);
					TiDev.resetConsole();
				}
				else
				{
					PackageProject.pollPackagingRequest(json.ticket,project.guid)
				}
			}
			else
			{
				$('#desktop_package_button').removeClass('disabled');
				alert('Packaging failed. HTTP status: ' + this.status);
				TiDev.resetConsole();
			}
		}
	};
	xhr.open("POST",url);
	var zipFile = Titanium.Filesystem.createTempFile();
	Titanium.Codec.createZip(destDir, zipFile, function() {
	  // complete callback
	  xhr.send(zipFile);
	});
};

PackageProject.pollPackagingRequest = function(ticket,guid)
{
	TiDev.invokeCloudService(PackageProject.publishStatusURL,{ticket:ticket},'POST',function(r)
	{
	   	if (r.status == 'complete')
	   	{
			var date = r.pubdate;
			var releases = r.releases;
			var appPage = r.app_page;
			TiDev.setConsoleMessage('Packaging was successful!', 2000);	
			
			//show links subtab
			//TiDev.subtabChange(2);
			$('#desktop_links').click();
			
			// enable packaging button
			$('#desktop_package_button').removeClass('disabled');
			
					
		}
		else if (r.success == false)
		{
			$('#desktop_package_button').removeClass('disabled');
			alert('Packaging failed with message: ' + r.message);
			TiDev.resetConsole();
			return;
		}
		else
		{
			// poll every 10 seconds
			setTimeout(function()
			{
				PackageProject.pollPackagingRequest(ticket,guid);
			},10000);
		}
	});
};

//
//  Add listener to resize
//
Titanium.UI.currentWindow.addEventListener(function(event)
{
	if(event == 'resized')
	{
		PackageProject.initializeConsoleWidth();
	}
});

// register module
TiDev.registerModule({
	name:'packaging',
	displayName: 'Test & Package',
	perspectives:['projects'],
	html:'packaging.html',
	idx:2,
	callback:PackageProject.eventHandler
});


Links = {};
Links.url = 'app-list';

//
// Setup row selection listener
//
$MQL('l:tidev.projects.row_selected',function(msg)
{
	if (msg.payload.activeTab == 'links' )
	{
		if (Projects.getProject().type !='mobile')
		{
			Links.setPageData();
		}
		else
		{
			TiDev.subtabChange(0);
		}
	}
});

Links.createPackagesTable = function()
{
	TiDev.db.execute('CREATE TABLE PROJECTPACKAGES (guid TEXT, label TEXT, url TEXT, platform TEXT, version TEXT, date TEXT,page_url TEXT)');
};

Links.deletePackagesForGUID = function(guid)
{
	try
	{
		TiDev.db.execute('DELETE from PROJECTPACKAGES WHERE guid = ?', guid);
	}
	catch (e)
	{
		Links.createPackagesTable();
	}
};

Links.getPackagesForGUID = function(guid)
{
	var dbRows = null;
	try
	{
		dbRows = TiDev.db.execute("SELECT url,page_url,label,platform,version,date from PROJECTPACKAGES WHERE guid = ?", guid);
	}
	catch (e)
	{
		Links.createPackagesTable();
	}

	return dbRows;
};

Links.addPackageToDatabase = function(guid, url, label, platform, version, lastUpdated, appPage)
{
	try
	{
		TiDev.db.execute("INSERT INTO PROJECTPACKAGES (guid,url,label,platform,version,date,page_url) values (?,?,?,?,?,?,?) ",
			guid, url, label, platform, version, lastUpdated, appPage);
	}
	catch (e)
	{
		Links.createPackagesTable();
		TiDev.db.execute("INSERT INTO PROJECTPACKAGES (guid,url,label,platform,version,date,page_url) values (?,?,?,?,?,?,?) ",
			guid, url, label, platform, version, lastUpdated, appPage);
	}
};

//
// Set page data
//
Links.setPageData = function()
{
	// get current project
	var p = Projects.getProject();

	// declare vars
	var linksArray = [];
	var dbRows = {};
	var appPage = null;
	var lastUpdatedDate = null;

	// get data in cache, create table if not exists
	dbRows = Links.getPackagesForGUID(p.guid);

	// get rows in db
	while (dbRows !== null && dbRows.isValidRow())
	{
		appPage = dbRows.fieldByName('page_url');
		lastUpdatedDate = dbRows.fieldByName('date');
		var platform = dbRows.fieldByName('platform');
		var url = dbRows.fieldByName('url');
		var label = dbRows.fieldByName('label');

		linksArray.push({url:url,label:label,platform:platform});
		dbRows.next();
	}

	// now try to load remote stats
	TiDev.invokeCloudService(Links.url,{guid:p.guid},'POST',function(data)
	{
		// if we have data, process
		if (data.releases)
		{
			// get base data
			linksArray = data.releases;
			var releases = data.releases;
			lastUpdatedDate = TiDev.formatPackagingDate(data.pubdate);
			appPage = data.app_page;
			
			// delete current rows
			Links.deletePackagesForGUID(p.guid);

			// insert new rows
			for (var i=0;i<releases.length;i++)
			{
				var r = releases[i]; 
				Links.addPackageToDatabase(p.guid, r.url, r.label, r.platform, data.version, lastUpdatedDate, appPage);
			}
		}
		loadData();
		
	},
	function()
	{
		loadData();
	}
	);
	
	function loadData()
	{
		TiUI.setBackgroundColor('#1c1c1c');

		// if we have data show it, otherwise show no data page
		if (linksArray.length !== 0)
		{
			// set ui state
			$('#links_view').css('display','block');
			$('#no_links_view').css('display','none');

			// public link
			$('#public_links_anchor').get(0).href = appPage;
			$('#public_links_anchor').html(appPage);

			var html = '';
			for (var i=0;i<linksArray.length;i++)
			{
				var classes = 'row  even';
				// if (i%2===0)
				// {
				// 	classes += 'even';
				// }
				html += '<div class="'+classes+'">';
				html += '<div class="platform"><img height="20" width="20" src="modules/packaging/images/' + linksArray[i].platform + '_small.png"/></div>';
				html += '<div class="label">' + linksArray[i].label + '</div>';
				html += '<div class="link"><a target="ti:systembrowser"  href="' + linksArray[i].url + '">'+linksArray[i].url+'</a></div>';	
				html += '</div>';
			}
			$('#links_view_rows').html(html);
			$('#links_date').html(lastUpdatedDate);
		}
		else
		{
			$('#links_view').css('display','none');
			$('#no_links_view').css('display','block');

		}
	}
	
};



