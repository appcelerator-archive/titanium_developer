var TiDev = Titanium.UI.getCurrentWindow().getParent().window.TiDev;
var database = TiDev.db;

// these are the sections and videos per section we want to be able to play
var videos = [
	{
		videos: 
		[
			{title:"Getting Started with Titanium",description:"Take a few minutes now to learn how to create and run your first<br/>desktop and mobile applications with Appcelerator Titanium.",videoid:6046968},
			{title:"Your first Desktop Application",description:"Take a few minutes to learn how to create your first<br/>Titanium desktop application",videoid:5067085},
			{title:"Your first Mobile Application",description:"Take a few minutes to learn how to create your first<br/>Titanium mobile application",videoid:5067085}
		]
	},
	{
		videos:
		[
			{title:"Foo Bar",description:"Take a few minutes now to learn how to create and run your first<br/>desktop and mobile applications with Appcelerator Titanium.",videoid:5067085}
		]
	},
	{	
		videos:
		[
			{title:"Setup your environment",description:"Take a few minutes now to learn how to create and run your first<br/>desktop and mobile applications with Appcelerator Titanium.",videoid:5067085},
			{title:"Kitchen Sink",description:"Take a few minutes now to learn how to create and run your first<br/>desktop and mobile applications with Appcelerator Titanium.",videoid:5067085},
			{title:"Your first project",description:"Take a few minutes now to learn how to create and run your first<br/>desktop and mobile applications with Appcelerator Titanium.",videoid:5067085},
			{title:"Developing and Debugging",description:"Take a few minutes now to learn how to create and run your first<br/>desktop and mobile applications with Appcelerator Titanium.",videoid:5067085},
			{title:"Deployment to Device",description:"Take a few minutes now to learn how to create and run your first<br/>desktop and mobile applications with Appcelerator Titanium.",videoid:5067085},
			{title:"Ship it!",description:"Take a few minutes now to learn how to create and run your first<br/>desktop and mobile applications with Appcelerator Titanium.",videoid:5067085}
		]
	}
];
var activeSection;
var activeIndex;
var activeVideo;
var activeTitle;
function selectVideo(idx,subidx)
{
	videos[idx].selected=subidx;
	var entry = videos[idx].videos[subidx];
	$('#title').html(entry.title);
	$('#description').html(entry.description);
	$('#entry_'+idx+'_'+subidx).addClass('active').removeClass('inactive');
	$('#prog_'+idx+'_'+subidx).addClass('active').removeClass('inactive');
	if (typeof(activeSection)!='undefined' && idx!=activeSection && subidx!=activeIndex)
	{
		$('#entry_'+activeSection+'_'+activeIndex).removeClass('active').addClass('inactive');
		$('#prog_'+activeSection+'_'+activeIndex).removeClass('active').addClass('inactive')
	}
	activeSection=idx;
	activeIndex=subidx;
	activeVideo=videos[idx].videos[subidx].videoid;
	activeTitle=videos[idx].videos[subidx].title;
	var flashvars = {
		clip_id:activeVideo,
		server:'vimeo.com',
		show_table:0,
		show_byline:0,
		show_portrait:0,
		color:'#009',
		fullscreen:1,
		js_api:1,
		js_onLoad:'vidload',
		hd_off:0
	};
	var params = {allowfullscreen:true,allowscriptaccess:'always',wmode:'transparent'};
	var attributes = {};
	swfobject.embedSWF("http://vimeo.com/moogaloop.swf", "video", "640", "368", "9.0.0","expressInstall.swf", flashvars, params, attributes);
}
function loadVideo(idx,subidx)
{
	var html = '';
	for (var c=0;c<videos[idx].videos.length;c++)
	{
		var v = videos[idx].videos[c];
		var vcls = (c==subidx) ? 'active' : 'inactive';
		var ecls = (v.completed ? 'complete ' : 'incomplete ') + vcls;
		html+='<div id="entry_'+idx+'_'+c+'" class="entry '+vcls+'" onclick="return selectVideo('+idx+','+c+');"><div id="prog_'+idx+'_'+c+'" class="progress '+ecls+'"><span>'+(c+1)+'</span></div><div class="title">'+v.title+'</div><div style="clear:both"></div></div>';
	}
	$('#videos').html(html);
	selectVideo(idx,subidx);
}
function playVideo()
{
	var vid = $('#video').get(0);
	vid.api_play();
}
function vidLoadingEvent(data)
{
	$('#videobutton').html(Math.round(data.percent)+'%');
	if(data.percent >= 5)
	{
		$('#videobutton').fadeOut().html("play &gt;");
	}
}
function vidPlayEvent()
{
	TiDev.track('ti.video',{action:'play',clip_id:activeVideo,source:'vimeo','title':activeTitle});
}
function vidFinishEvent()
{
	TiDev.track('ti.video',{action:'finish',clip_id:activeVideo,source:'vimeo','title':activeTitle});
	database.execute("update VIDEOS set status=1 where section=? and video=?",activeSection,activeIndex);
	videos[activeSection].videos[activeIndex].completed=1;
	$('#prog_'+activeSection+'_'+activeIndex).removeClass('incomplete').addClass('complete');
	$('#videobutton').fadeIn();
	if (confirm("Congratulations! Let your friends know on Facebook that you've finished training"))
	{
		var fb = Titanium.Facebook.createSession("6d6537bbec4526347a6af5d4510e5091");
		fb.login(function()
		{
			
		});
	}
}
function vidload()
{
	var vid = $('#video').get(0);
	vid.api_addEventListener('onPlay','vidPlayEvent');
	vid.api_addEventListener('onFinish','vidFinishEvent');
	vid.api_addEventListener('onLoading','vidLoadingEvent');
}
$(function()
{
	$('#close').click(function()
	{ 
		Titanium.UI.getCurrentWindow().close();
	});
	$('#confirm_check').change(function()
	{
		var show = $('#confirm_check').val() == 'on' ? 1 : 0;
		database.execute("update WELCOME set SHOW = ?",show);
		TiDev.track('ti.welcome',{show:show});
	});
	
	$('#videobutton').click(playVideo);
	
	try
	{
		var rs = database.execute("select section,video,status from VIDEOS");
		while (rs.isValidRow())
		{
			var section = rs.field(0);
			var vid = rs.field(1);
			var status = rs.field(2);
			videos[section].videos[vid].completed = (status==1);
			rs.next();
		}
		rs.close();
	}
	catch(e)
	{
		database.execute("create table if not exists VIDEOS(section INT,video INT,status INT)");
		for (var c=0;c<videos.length;c++)
		{
			for (var x=0;x<videos[c].videos.length;x++)
			{
				database.execute("insert into VIDEOS values (?,?,?)",c,x,0);
			}
		}
	}
	
	activeSection=0;
	activeIndex=0;

	// attempt to load a specific section/video if passed in
	if (document.location.search)
	{
		var qs = document.location.search.substring(1).split("&");
		var entries = {};
		for (var c=0;c<qs.length;c++)
		{
			var e = qs[c].split("=");
			entries[decodeURIComponent(e[0])]=decodeURIComponent(e[1]);
		}
		activeSection=parseInt(entries.section);
		activeIndex=parseInt(entries.video);
	}
	else
	{
		// cycle through all videos and find the one video we haven't watched
		var stop = false;
		for (var c=0;c<videos.length;c++)
		{
			for (var x=0;x<videos[c].videos.length;x++)
			{
				if (!videos[c].videos[x].completed)
				{
					stop=true;
					activeSection=c;
					activeIndex=x;
					break;
				}
			}
			if (stop) break;
		}
	}

	var bar = new TiUI.GreyButtonBar();
	bar.configure({
		id:'tiui_perspective_bar',
		tabs: [{text:'Intro'},{text:'Desktop'},{text:'Mobile'}],
		active: activeSection,
		title:'',
		tabOrButton:'tab',
		tabItemWidth:60
	});
	
	// setup perspective listener
	bar.addListener(function(idx)
	{
		loadVideo(idx,videos[idx].selected||0);
	});
	
	loadVideo(activeSection,activeIndex);
});
