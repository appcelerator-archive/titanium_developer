Analytics = {};
Analytics.url = "app-stats";

//
// Setup row selection listener
//
$MQL('l:tidev.projects.row_selected',function(msg)
{
	if (msg.payload.activeTab == 'analytics')
	{
//		Analytics.setPageData();
		$('#analytics_view').css('display','none');
		$('#no_analytics_view').css('display','block');

	}
});

//
// Set page data
//
Analytics.setPageData = function()
{
	// get current project
	var p = Projects.getProject();
	
	// get cached data
	var statsArray = [];
	var dbRows = {};
	var lastUpdatedDate = null;
	
	try
	{
		dbRows = TiDev.db.execute("SELECT platform, count, date from PROJECTDOWNLOADS WHERE guid = ?",p.guid);
	}
	catch (e)
	{
		// if error, then create table
		TiDev.db.execute('CREATE TABLE PROJECTDOWNLOADS (guid TEXT, platform TEXT, count TEXT, date TEXT)');
	}

	// get rows in db
	if (dbRows.isValidRow)
	{
		while (dbRows.isValidRow())
		{
			var platform = dbRows.fieldByName('platform');
			var count = dbRows.fieldByName('count');
			var lastUpdatedDate = dbRows.fieldByName('date');
			statsArray.push({name:platform,value:count,guid:p.guid})
			dbRows.next();
		}
	}
	
	// now try to load remote stats
	TiDev.invokeCloudService(Analytics.url,{'guid':p.guid},'POST', function(data)
	{
		// if we have data, process
		if (data.length > 0)
		{
			// delete current rows
			TiDev.db.execute('DELETE from PROJECTDOWNLOADS WHERE guid = ?',p.guid);
			statsArray = [];
			
			// format new rows and insert
			var date = new Date().toLocaleString();
			for (var i=0; i< data.length;i++)
			{
				TiDev.db.execute("INSERT into PROJECTDOWNLOADS (guid, platform, count,date) values (?,?,?,?)",p.guid,data[i]['os'],data[i]['count'], date);
				var platform = data[i]['os'];
				var count = data[i]['count'];
				statsArray.push({name:platform,value:count,guid:p.guid});
			}
		}
	});

	TiUI.setBackgroundColor('#1c1c1c');

	// if we have data, show it
	if (statsArray.length > 0)
	{
		$('#analytics_view').css('display','block');
		$('#no_analytics_view').css('display','none');
		App.createControl('analytics_downloads','chart',{'property':'rows','type':'bar','background-color':'#1c1c1c','textColor':'#999999','lineColor':'#999999'},function()
		{
			this.execute({rows:statsArray});
		});
	}
	// otherwise show no data page
	else
	{
		$('#analytics_view').css('display','none');
		$('#no_analytics_view').css('display','block');
	}
};

//
// Setup UI View
//
Analytics.setupView = function()
{
	TiDev.contentLeft.show();
	TiDev.contentLeftHideButton.show();
	TiDev.contentLeftShowButton.hide();		
	//Analytics.setPageData();
	$('#analytics_view').css('display','none');
	$('#no_analytics_view').css('display','block');
	
};

// setup event handler
Analytics.eventHandler = function(event)
{
	if (event == 'focus')
	{
		Analytics.setupView();
	}
	else if (event == 'load')
	{
		Analytics.setupView();
	}
	else
	{
		
	}
};


// register module
TiDev.registerModule({
	name:'analytics',
	displayName: 'Analytics',
	perspectives:['projects'],
	html:'analytics.html',
	idx:3,
	callback:Analytics.eventHandler
});