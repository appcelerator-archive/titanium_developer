
if (typeof(Titanium)=='undefined') Titanium = {};

var TFS = Titanium.Filesystem;

Titanium.Project = 
{
	requiredModulesList: ['api','tiapp','tifilesystem','tiplatform','tiui','javascript','tianalytics'],
	requiredModules:[],
	optionalModules:[],

	hasAnalytics: function(project)
	{
		var hasAnalytics = true;
		var tiapp = Titanium.Filesystem.getFileStream(project.dir,'tiapp.xml');
		tiapp.open(Titanium.Filesystem.MODE_READ);
		var line = tiapp.readLine(true);
		while (true)
		{
			line = tiapp.readLine();
			if(line==null)
			{
				tiapp.close();
				break;
			} 
			if (line.indexOf('<analytics') != -1)
			{
				if (line.indexOf('false') != -1)
				{
					hasAnalytics = false;
				}
				break;
			}
		}
		tiapp.close();
		return hasAnalytics;
	},
	
	getModuleVersion: function(versions)
	{
		var latestVer = 0
		for (var i=0;i<versions.length;i++)
		{
			var ver = parseFloat(versions[i]);
			if (ver > latestVer)
			{
				latestVer = ver;
			}
		}
		return ver;
	},
	setModules: function(project)
	{
		this.requiredModules = [];
		this.optionalModules = [];

		// Read the application manifest for this application and
		// find all the necessary components.
		var app = Titanium.API.readApplicationManifest(project.dir +
			Titanium.Filesystem.getSeparator() + 'manifest');
		var deps = app.getDependencies();

		// Get all modules of the same version as the project runtime.
		var names = [];
		var modules = Titanium.API.getApplication().getAvailableModules();
		for (var i = 0; i < modules.length; i++)
		{
			var module = modules[i];

			if (module.type != Titanium.API.MODULE)
				continue;
			// Don't include duplicates and modules of a different version.
			if (module.version != project.runtime || names.indexOf(module.name) != -1)
				continue;

			names.push(module.name);
			if (this.requiredModulesList.indexOf(module.name) == -1)
				this.optionalModules.push(module);
			else
				this.requiredModules.push(module);
		}

		// Preserve SDK and MobileSDK dependencies.
		this.sdkDependency = this.mobileSDKDependency = null;
		for (var i = 0; i < deps.length; i++)
		{
			// If we have an SDK dependency, we always want it to match
			// the version of the project runtime. Don't preserve any
			// old version here.
			if (deps[i].type == Titanium.API.SDK)
				this.sdkDependency = project.runtime;
			if (deps[i].type == Titanium.API.MOBILESDK)
				this.mobileSDKDependency = deps[i].version;
		}
	},
	writeManifest: function(project)
	{
		this.setModules(project); //project.dir, project.runtime);

		var resources = TFS.getFile(project.dir,'Resources');

		// build the manifest
		var manifest = '#appname:'+project.name+'\n';
		manifest+='#appid:'+project.appid+'\n';
		manifest+='#publisher:'+project.publisher+'\n';

		if (project.image)
		{
			// look for image in two places - either full path or in resources dir
			var image = TFS.getFile(project.image);
			if (!image.exists())
			{
				image = TFS.getFile(resources,project.image);
			}
			// use default if not exists
			if (!image.exists())
			{
				var path = Titanium.App.appURLToPath('app://images');
				image = TFS.getFile(path,'default_app_logo.png')
			}
			
			var image_dest = TFS.getFile(resources,image.name());
			if (image.toString() != image_dest.toString())
			{
				image.copy(image_dest);
			}
			imageName = image.name();
			manifest+='#image:'+image.name()+'\n';
		}

		manifest+='#url:'+project.url+'\n';
		manifest+='#guid:'+project.guid+'\n';
		manifest+='#desc:'+project.description+'\n';
		manifest+='#type:'+project.type+'\n';
		var stream = null;
		var developerManifest = Titanium.API.getApplication().getManifest();
		for (var i = 0; i < developerManifest.length; i++)
		{
			if (developerManifest[i][0] == "#stream")
			{
				stream = developerManifest[i][1];
				break;
			}
		}

		// copy developer's stream into the app if it's non-default
		if (stream)
			manifest += "#stream:"+stream+'\n';

		manifest+='runtime:'+project.runtime+'\n';
		if (this.mobileSDKDependency)
			manifest += "mobilesdk:" + this.mobileSDKDependency + "\n";
		if (this.sdkDependency)
			manifest += "sdk:" + this.sdkDependency + "\n";
		
		var hasAnalytics =this.hasAnalytics(project);
		
		// write out required modules
		for (var i=0;i<this.requiredModules.length;i++)
		{
			// analytics disabled then ignore
			if (hasAnalytics==false && this.requiredModules[i].name == 'tianalytics')
			{
				continue;
			}
			
			manifest+= this.requiredModules[i].name +':'+ this.requiredModules[i].version+'\n';
		}
		// write out optional modules
		for (var c=0;c<this.optionalModules.length;c++)
		{
			if (project.appid != 'com.appcelerator.titanium.developer' && this.optionalModules[c].name.indexOf('sdk')!=-1)
				continue;
				
			// check for optional ruby language module
			if (this.optionalModules[c].name == 'ruby')
			{
				if (project['languageModules'].ruby == 'on')
				{
					manifest+=this.optionalModules[c].name+':'+this.optionalModules[c].version+'\n';
				}
				continue;
			}

			// check for optional python language module
			if (this.optionalModules[c].name == 'python')
			{
				if (project['languageModules'].python == 'on')
				{
					manifest+=this.optionalModules[c].name+':'+this.optionalModules[c].version+'\n';
				}
				continue;
			}
			// check for optional php language module
			if (this.optionalModules[c].name == 'php')
			{
				if (project['languageModules'].php == 'on')
				{
					manifest+=this.optionalModules[c].name+':'+this.optionalModules[c].version+'\n';
				}
				continue;
			}
			
			manifest+=this.optionalModules[c].name+':'+this.optionalModules[c].version+'\n';
		}

		var mf = TFS.getFile(project.dir,'manifest');
		mf.write(manifest);
		return manifest;
		
	},
	launch: function(project,install,callback,args)
	{
		try
		{
			// write out new manifest based on current modules
			var manifest = this.writeManifest(project);

			// create dist dir
			var dist = TFS.getFile(project.dir,'dist',Titanium.platform);
			dist.createDirectory(true);

			// create app
			var app = Titanium.createApp(this.runtimeComponent,dist,project.name,project.appid,install);

			// write out new manifest
			var app_manifest = TFS.getFile(app.base,'manifest');
			app_manifest.write(manifest);
			
			// write out tiapp.xml
			var resources = TFS.getFile(project.dir,'Resources');
			var tiapp = TFS.getFile(project.dir,'tiapp.xml');
			tiapp.copy(app.base);

			TFS.asyncCopy(resources,app.resources,function()
			{
				// no modules to bundle, install the net installer
				var net_installer_src = TFS.getFile(runtime,'installer');
				var net_installer_dest = TFS.getFile(app.base,'installer');
				TFS.asyncCopy(net_installer_src,net_installer_dest,function(filename,c,total)
				{
					var appModules = TFS.getFile(project.dir,"modules");
					if (appModules.exists())
					{
						var moduleDest = TFS.getFile(app.base,"modules");
						TFS.asyncCopy(appModules,moduleDest, function()
						{
							args.unshift(app.executable.nativePath());
							var x =  Titanium.Process.createProcess({args: args, env: {"KR_DEBUG": "true"}});
							x.launch();
							if (x && callback)
							{
								callback(x);
							}
						});
					}
					else
					{
						args.unshift(app.executable.nativePath());
						var x = Titanium.Process.createProcess({args: args, env: {"KR_DEBUG": "true"}});
						if (x && callback)
						{
							callback(x);
						}
					}
				});
			});
		}
		catch(e)
		{
			alert('Error launching app ' + e);
		}
		
	},
	
	getSDKVersions: function(version)
	{
		var modules = Titanium.API.getInstalledSDKs();
		var versions = [];
		var tracker = {};
		if (modules)
		{
			for(var i=0;i<modules.length;i++)
			{
				if (!tracker[modules[i].getVersion()])
				{
					if (version)
					{
						if (version == modules[i].getVersion())
						{
							return modules[i];
						}
					}
					else
					{
						versions.push(modules[i].getVersion());
						tracker[modules[i].getVersion()]=true;
					}
				}
			}
		}
		return versions;
	},
	getMobileSDKVersions: function(version)
	{
		var modules = Titanium.API.getInstalledMobileSDKs();
		var versions = [];
		var tracker = {};
		if (modules)
		{
			for(var i=0;i<modules.length;i++)
			{
				if (!tracker[modules[i].getVersion()])
				{
					if (version)
					{
						if (version == modules[i].getVersion())
						{
							return modules[i]
						}
					}
					else
					{
						versions.push(modules[i].getVersion());
						tracker[modules[i].getVersion()]=true;
					}
				}
			}
		}
		return versions;
	},
	parseEntry:function(entry)
	{
		if (entry[0]==' ' || entry.length==0) return null;
		var i = entry.indexOf(':');
		if (i < 0) return null;
		var key = jQuery.trim(entry.substring(0,i));
		var value = jQuery.trim(entry.substring(i+1));
		var token = false;
		if (key.charAt(0)=='#')
		{
			token = true;
			key = key.substring(1);
		}
		return {
			key: key,
			value: value,
			token: token
		};
	},
	addEntry:function(line,result)
	{
		if (line)
		{
			var entry = Titanium.Project.parseEntry(line);
			if (!entry) return;
			if (entry.token) 
				result.properties[entry.key]=entry.value;
			else
				result.map[entry.key]=entry.value;
		}
	},
	getManifest:function(mf)
	{
		var manifest = TFS.getFile(mf);
		if (!manifest.isFile())
		{
			return {
				success:false,
				message:"Couldn't find manifest!"
			};
		}
		var result = {
			success:true,
			file:manifest,
			map:{},
			properties:{}
		};
		var line = manifest.readLine(true);
		Titanium.Project.addEntry(line,result);
		while (true)
		{
			line = manifest.readLine();
			if(!line) break;
			Titanium.Project.addEntry(line,result);
		}
		return result;
	},
	createMobileResources: function(options)
	{
		var resources = TFS.getFile(options.dir,options.name,'Resources');
		
		// create main index file;
		//this.createIndexFile(resources,options);
		
		// create manifest
		this.writeInitialManifest(TFS.getFile(options.dir,options.name),options);
		
		// write out guid for new project
		var tiapp = Titanium.Filesystem.getFileStream(options.dir,options.name,'tiapp.xml');
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
			if (line.indexOf('<guid') != -1)
			{
				newXML += '<guid>' + options.guid + '</guid>\n';
				continue;
			}
			newXML += line + '\n';
		}
		tiapp.open(Titanium.Filesystem.MODE_WRITE);
		tiapp.write(newXML);
		tiapp.close();
		
		
	},
	createIndexFile:function(resources,options)
	{
		var index = TFS.getFile(resources,'index.html');
		var head = '';
		
		if (options.html)
		{
			head+='<head>\n';		
		}

		var jquery = '<script type="text/javascript" src="jquery-1.3.2.js"></script>\n';
		var entourage = '<script type="text/javascript" src="entourage-jquery-3.0.js"></script>\n';
		var prototype_js = '<script type="text/javascript" src="prototype-1.6.0.js"></script>\n';
		var scriptaculous = '<script type="text/javascript" src="scriptaculous-1.8.2.js"></script>\n';
		var mootools = '<script type="text/javascript" src="mootools-1.2.1.js"></script>\n';
		var yahoo = '<script type="text/javascript" src="yui-2.6.0.js"></script>\n';
		var swfobject = '<script type="text/javascript" src="swfobject-1.5.js"></script>\n';
		var dojo = '<script type="text/javascript" src="dojo-1.2.3.js"></script>\n';
		
		var path = Titanium.App.appURLToPath('app://thirdparty_js');
		if (options.jsLibs)
		{
			for (var i=0;i<options.jsLibs.length;i++)
			{
				switch (options.jsLibs[i])
				{
					case 'jquery':
					{
						head += jquery
						var f = TFS.getFile(path,'jquery-1.3.2.js');
						f.copy(resources);
						continue;
					}
					case 'entourage':
					{
						head += entourage;
						var f = TFS.getFile(path,'entourage','entourage-jquery-3.0.js');
						f.copy(resources);
						var f2 = TFS.getFile(path,'entourage','entourage-ui');
						f2.copy(resources);
						continue;
					}
					case 'mootools':
					{
						head+=mootools;
						var f = TFS.getFile(path,'mootools-1.2.1.js');
						f.copy(resources);
						continue;
					}
					case 'prototype':
					{
						head+= prototype_js;
						var f = TFS.getFile(path,'prototype-1.6.0.js');
						f.copy(resources);
						continue;
					}
					case 'scriptaculous':
					{
						head+=scriptaculous;
						var f = TFS.getFile(path,'scriptaculous-1.8.2.js');
						f.copy(resources);
						continue;
					}
					case 'dojo':
					{
						head+=dojo;
						var f = TFS.getFile(path,'dojo-1.2.3.js');
						f.copy(resources);
						continue;
					}
					case 'yui':
					{
						head+=yahoo;
						var f = TFS.getFile(path,'yui-2.6.0.js');
						f.copy(resources);
						continue;
					}
					case 'swf':
					{
						head+=swfobject;
						var f = TFS.getFile(path,'swfobject-1.5.js');
						f.copy(resources);
						continue;
					}
				}
				
			}
		}

		if (options.html)
		{
			head += '</head>';
			index.write('<html>\n'+head+'\n<body>\n' + options.html + '\n</body>\n</html>')
		}
		else
		{
			if (index.exists())
			{
				var contents = index.read();
				var headEnd = contents.indexOf('head');
				var front = contents.substring(0,(headEnd+5));
				var back = contents.substring((headEnd+5));
				index.write(front + '\n' + head +'\n'+ back);
			}
			else
			{
				index.write('<html><head>'+head+'</head><body style="background-color:#1c1c1c;margin:0"><div style="border-top:1px solid #404040"><div style="color:#fff;;padding:10px">Welcome to Titanium</div></div></body></html>');
			}
		}
		
		
	},
	writeInitialManifest: function(dir,options)
	{
		var manifest = "#appname: "+options.name+"\n" +
		"#publisher: "+options.publisher+"\n"+
		"#url: "+options.url+"\n"+
		"#image: "+options.image+"\n"+
		"#appid: "+options.id+"\n"+
		"#desc: "+options.desc+"\n"+
		"#type: "+options.type+"\n"+
		"#guid: " +  options.guid + "\n";		
		var mf = TFS.getFile(dir,'manifest');
		mf.write(manifest);
		
	},
	create:function(options)
	{
		var name = options.name;
		var guid = options.guid;
		var desc = options.desc;
		var dir = options.dir;
		var publisher = options.publisher;
		var url = options.url;
		var image = options.image;
		var jsLibs = options.jsLibs;
		var html = options.html;
		var type = options.type;
		var id = options.id;
		
		var outdir = TFS.getFile(dir,name);
		if (outdir.isDirectory())
		{
			return {
				success:false,
				message:"Directory already exists: " + outdir
			}
		}
		outdir.createDirectory(true);

		// write out the TIAPP.xml
		var tiappxml = this.XML_PROLOG;
		var year = new Date().getFullYear();
		tiappxml+='<!-- These values are edited/maintained by Titanium Developer -->\n';
		tiappxml+=this.makeEntry('id',id);
		tiappxml+=this.makeEntry('name',name);
		tiappxml+=this.makeEntry('version','1.0');
		tiappxml+=this.makeEntry('publisher',publisher);
		tiappxml+=this.makeEntry('url',url);
		tiappxml+=this.makeEntry('icon',image);
		tiappxml+=this.makeEntry('copyright',year+' by '+publisher);
		tiappxml+='<!-- Window Definition - these values can be edited -->\n';
		tiappxml+="<window>\n";
		tiappxml+=this.makeEntry('id','initial');
		tiappxml+=this.makeEntry('title',name);
		tiappxml+=this.makeEntry('url','app://index.html');
		tiappxml+=this.makeEntry('width','700');
		tiappxml+=this.makeEntry('max-width','3000');
		tiappxml+=this.makeEntry('min-width','0');
		tiappxml+=this.makeEntry('height','500');
		tiappxml+=this.makeEntry('max-height','3000');
		tiappxml+=this.makeEntry('min-height','0');
		tiappxml+=this.makeEntry('fullscreen','false');
		tiappxml+=this.makeEntry('resizable','true');
		tiappxml+=this.makeEntry('chrome','true',{'scrollbars':'true'});
		tiappxml+=this.makeEntry('maximizable','true');
		tiappxml+=this.makeEntry('minimizable','true');
		tiappxml+=this.makeEntry('closeable','true');
		tiappxml+="</window>\n";
		tiappxml+=this.XML_EPILOG;
		var ti = TFS.getFile(outdir,'tiapp.xml');
		ti.write(tiappxml);
		var resources = TFS.getFile(outdir,'Resources');
		resources.createDirectory();

		// create main index file;
		this.createIndexFile(resources,options);
		
		// create manifest
		this.writeInitialManifest(outdir,options);
		
		var gi = TFS.getFile(outdir,'.gitignore');
		gi.write('dist\ntmp\n');
		
		var dist = TFS.getFile(outdir,'dist');
		dist.createDirectory();
		
		return {
			basedir: outdir,
			resources: resources,
			id: id,
			name: name,
			success:true
		};
	},
	makeEntry:function(key,value,attrs,tabCount)
	{
		var str = (tabCount==3)?'            <':(tabCount==2)?'        <':(tabCount==1)?'    <':'<';
		str += key;
		if (attrs && attrs != null)
		{
			str+=' ';
			var values = [];
			for (name in attrs)
			{
				var v = attrs[name];
				if (v)
				{
					values.push(name + '=' + '"' + v + '"');
				}
			}
			str+=values.join(' ');
		}
		str+='>' + value + '</'+key+'>\n';
		return str;
	},
	
	updateManifest: function(values,addGuid)
	{
		var manifest = TFS.getFile(values.dir,"manifest");
		var normalized_name = name.replace(/[^a-zA-Z0-9]/g,'_').toLowerCase();
		normalized_name = normalized_name.replace(/ /g,'_').toLowerCase();
		var normalized_publisher = publisher.replace(/[^a-zA-Z0-9]/g,'_').toLowerCase();
		normalized_publisher = normalized_publisher.replace(/ /g,'_').toLowerCase();
		var id = 'com.'+normalized_publisher+'.'+normalized_name;
		var newManifest = ''

		// add guid if not exists
		if (addGuid ==true)
		{
			newManifest = '#guid:'+values.guid+"\n";
		}

		var line = manifest.readLine(true);
		var entry = Titanium.Project.parseEntry(line);
		for (var i=0;i<1000;i++)
		{
			if (entry == null)
			{
				line = manifest.readLine();
				if (!line || line == null)break;
				entry = Titanium.Project.parseEntry(line);
			}
			if (entry.key.indexOf('appname') != -1)
			{
				newManifest += '#appname:'+values.name+"\n";
			}
			else if (entry.key.indexOf('publisher') != -1)
			{
				newManifest += '#publisher:'+values.publisher+"\n";
			}
			else if (entry.key.indexOf('url') != -1)
			{
				newManifest += '#url:'+values.url+"\n";
			}
			else if (entry.key.indexOf('image') != -1)
			{
				newManifest += '#image:'+values.image+"\n";
			}
			else if (entry.key.indexOf('appid') != -1)
			{
				newManifest += '#appid:'+id+"\n";
			}
			else if (entry.key.indexOf('guid') != -1)
			{
				newManifest += '#guid:'+values.guid+"\n";
			}
			else if (entry.key.indexOf('description') != -1)
			{
				newManifest += '#desc:'+values.description+"\n";
			}

			else
			{
				newManifest += entry.key + ":"  + entry.value + "\n";
			}
			entry = null;
		}
		manifest.write(newManifest);
   }
};



Titanium.Project.XML_PROLOG = "<?xml version='1.0' encoding='UTF-8'?>\n" +
	"<ti:app xmlns:ti='http://ti.appcelerator.org'>\n";
	
Titanium.Project.XML_EPILOG = "</ti:app>";
	
