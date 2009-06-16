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

Links.insertDBData

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
	try
	{
		dbRows = TiDev.db.execute("SELECT url, page_url,label,platform, version, date from PROJECTPACKAGES WHERE guid = ?",p.guid);
	}
	catch (e)
	{
		TiDev.db.execute('CREATE TABLE PROJECTPACKAGES (guid TEXT, label TEXT, url TEXT, platform TEXT, version TEXT, date TEXT,page_url TEXT)')
	}

	// get rows in db
	while (dbRows.isValidRow())
	{
		appPage = dbRows.fieldByName('page_url');
		lastUpdatedDate = dbRows.fieldByName('date')
		var platform = dbRows.fieldByName('platform');
		var url = dbRows.fieldByName('url');
		var label = dbRows.fieldByName('label');

		linksArray.push({url:url,label:label,platform:platform})
		dbRows.next();
	}

	// now try to load remote stats
	TiDev.invokeCloudService(Links.url,{guid:p.guid},'GET',function(data)
	{
		// if we have data, process
		if (data.releases)
		{
			// get base data
			linksArray = [];
			var releases = data.releases;
			lastUpdatedDate = TiDev.formatPackagingDate(data.pubdate);
			appPage = data.app_page
			
			// delete current rows
			TiDev.db.execute('DELETE from PROJECTPACKAGES WHERE guid = ?',p.guid);

			// insert new rows
			for (var i=0;i<releases.length;i++)
			{
		        TiDev.db.execute("INSERT INTO PROJECTPACKAGES (guid,url, label,platform, version, date,page_url) values (?,?,?,?,?,?,?) ",p.guid,releases[i]['url'],releases[i]['label'],releases[i]['platform'],data['version'],lastUpdatedDate,appPage);
				var url = releases[i]['url'];
				var label = releases[i]['label'];
				var platform = releases[i]['platform'];
				linksArray.push({'url':url,'label':label,'platform':platform});
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
		if (linksArray.length != 0)
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
				var classes = 'row ';
				if (i%2==0)
				{
					classes += 'even';
				}
				html += '<div class="'+classes+'">';
				html += '<div class="platform"><img height="20" width="20" src="modules/links/images/' + linksArray[i].platform + '_small.png"/></div>';
				html += '<div class="label">' + linksArray[i].label + '</div>';
				html += '<div class="link"><a target="ti:systembrowser"  href="' + linksArray[i].url + '">'+linksArray[i].url+'</a></div>';	
				html += '</div>'	
			}
			$('#links_view_rows').html(html);
			$('#links_date').html(lastUpdatedDate);
		}
		else
		{
			$('#links_view').css('display','none');
			$('#no_links_view').css('display','block');

		}
	};
	
};

//
// Setup UI View
//
Links.setupView = function()
{
	TiDev.contentLeft.show();
	TiDev.contentLeftHideButton.show();
	TiDev.contentLeftShowButton.hide();		
	Links.setPageData()
};

// setup event handler
Links.eventHandler = function(event)
{
	if (event == 'focus')
	{
		Links.setupView();
	}
	else if (event == 'load')
	{
		Links.setupView();
	}
	else
	{
		
	}
};

// register module
TiDev.registerModule({
	name:'links',
	displayName: 'Links',
	perspectives:['projects'],
	html:'links.html',
	idx:2,
	callback:Links.eventHandler
});

