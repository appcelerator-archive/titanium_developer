$(function()
{
	$('#close').click(function()
	{ 
		Titanium.UI.getCurrentWindow().close();
	});
	$('#confirm_check').change(function()
	{
		var show = $('#confirm_check').val() == 'on' ? 1 : 0;
		Titanium.UI.getCurrentWindow().getParent().window.TiDev.db.execute("update WELCOME set SHOW = ?",show);
		TiDev.track('ti.welcome',{show:show});
	});
	
	var flashvars = {
		clip_id:5067085,
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
	var params = {allowfullscreen:true,allowscriptaccess:'always'};
	var attributes = {};
	swfobject.embedSWF("http://vimeo.com/moogaloop.swf", "video", "640", "368", "9.0.0","expressInstall.swf", flashvars, params, attributes);
});
function vidPlay()
{
	TiDev.track('ti.video',{action:'play',clip_id:5067085,source:'vimeo'});
}
function vidFinish()
{
	TiDev.track('ti.video',{action:'finish',clip_id:5067085,source:'vimeo'});
}
function vidload()
{
	var vid = $('#video').get(0);
	vid.api_addEventListener('onPlay','vidPlay');
	vid.api_addEventListener('onFinish','vidFinish');
}
