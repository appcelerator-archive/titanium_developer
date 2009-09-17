importScript("app://modules/packaging/js/jslint.js");

onmessage = function(event)
{
	var f = Titanium.Filesystem.getFile(event.message.file);
	var contents = f.read().toString();
	
	// if it looks like jQuery, skip it ... too many warnings that are OK
	if (contents.indexOf('jQuery') > 0 && contents.indexOf('Sizzle') > 0)
	{
		postMessage({path:event.message.path,id:event.message.id,result:true});
	}
	else
	{
		
		var result = JSLINT(contents,{browser:true,evil:true,eqeqeq:false,maxerr:100,predef:["Titanium","window"]});
		var report = JSLINT.report(true);
		postMessage({path:event.message.path,id:event.message.id,result:result,errors:JSLINT.errors,report:report,data:JSLINT.data()});
	}
};
