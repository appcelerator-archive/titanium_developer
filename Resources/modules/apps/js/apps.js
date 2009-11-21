Apps = {};
Apps.buttonBar =  new TiUI.BlackButtonBar();
Apps.app_list_url = 'app-list';
Apps.app_rate_url = 'app-rate';
Apps.iterator = null;
Apps.popular = [];
Apps.download = [];
Apps.recent = [];
Apps.setupView = function()
{
	// create app iterator
	// App.createControl('app_list_iterator','iterator',{'property':'rows'},function()
	// {
	// 	Apps.iterator = this;
	// });

	// set default UI state
	TiUI.setBackgroundColor('#161616');
	TiDev.contentLeft.hide();
	TiDev.contentLeftHideButton.hide();
	TiDev.contentLeftShowButton.hide();		
	
	// configure button bar
	Apps.buttonBar.configure({id:'tiui_content_submenu',tabs:['Most Popular','Most Downloaded','Most Recent'],active:0,search:true});
	
	// add search listener
	Apps.buttonBar.addSearchListener(function(val,idx)
	{
		var options = {};
		options.search = val;
		if (idx == 0)
		{
			options.sort = 'popular';
		}
		else if (idx == 1)
		{
			options.sort = 'download';
		}
		else
		{
			options.sort = 'recent';
		}
		Apps.findApps(options);
	});
	
	// add tab click listener
	Apps.buttonBar.addListener(function(idx)
	{
		var options = {};
		options.sort = 'popular';
		options.search = '';
		if (idx == 1)
		{
			options.sort = 'download'
		}
		else if (idx == 2)
		{
			options.sort = 'recent'
		}
		Apps.findApps(options);
	})

	// load initial apps
	Apps.findApps({sort:'popular',search:''});

}

// setup event handler
Apps.eventHandler = function(event)
{
	if (event == 'focus')
	{
		Apps.setupView();
	}
	else if (event == 'load')
	{
		Apps.setupView();
	}
	else if (event == 'blur')
	{
		Apps.buttonBar.hide();
	}
};

//
// Rating Function
//
Apps.setupRating = function(data)
{
	// set rating
	for (var i=0;i<data.length;i++)
	{
		var value = data[i].value;
		var id = data[i]['app_id'];
		for (var j=1;j<=value;j++)
		{
			$('#rating_' + id + '_' + j).removeClass('rating_off');
			
		}
	}
	
	// capture rating on click
	$('.rating').click(function()
	{
		var id = $(this).attr('app_id');
		var guid = $(this).attr('guid');
		var ratingStr = $('#rating_string_' + id);
		var hasVoted = ratingStr.attr('hasVoted');
		var vote = parseInt($(this).attr('star'));
		var votes = parseInt(ratingStr.attr('votes'));
		var rating = parseFloat(ratingStr.attr('rating'));
		
		
		// we only count vote
		if (hasVoted == "true")
		{
			ratingStr.css('display','none');
			$('#already_voted_'+id).fadeIn();
			setTimeout(function()
			{
				$('#already_voted_'+id).css('display','none');
				ratingStr.fadeIn();
				
			},1500);
		}
		else
		{
			var totalRating = (votes * rating) + vote;
			votes++;
			var newRating = String(totalRating/votes);
			if (newRating.indexOf('.')!=-1)
			{
				newRating = newRating.split('.')
				newRating = newRating[0] + "." + newRating[1].substring(0,2);
			}
			else
			{
				newRating = newRating;
			}

			ratingStr.css('display','none');
			ratingStr.html(newRating+' rating from '+votes+' votes');
			$('#voted_success_'+id).fadeIn();
			setTimeout(function()
			{
				$('#voted_success_'+id).css('display','none');
				ratingStr.fadeIn();
				
			},1500);

			// do we need to update stars
			if (parseFloat(newRating) > (parseInt(rating) + 1))
			{
				$('#rating_' + id + '_' + (parseInt(rating) +1)).removeClass('rating_off');
			}
			else if (parseFloat(newRating) < parseInt(rating))
			{
				$('#rating_' + id + '_' + rating).addClass('rating_off');
			}
			ratingStr.attr('rating',newRating);
			ratingStr.attr('hasVoted','true');
			ratingStr.attr('votes',votes);
			
			// rate app
			TiDev.invokeCloudService(Apps.app_rate_url,{rating:vote,guid:guid,mid:Titanium.Platform.id},'GET');
			
			TiDev.track('app-rate',{guid:guid,rating:vote});
		}
	});
	

	// enable mouseover
	$('.rating').mouseover(function()
	{
		var id = $(this).attr('app_id');
		var star = parseInt($(this).attr('star'));
		
		// start 3
		// rating 5
		for (var i=star;i>=1;i--)
		{
			$('#rating_' + id + '_' + i).removeClass('rating_off');
		}
		for (var i=5;i>star;i--)
		{
			$('#rating_' + id + '_' + i).addClass('rating_off');
		}
	});

	// enable mouseout
	$('.rating').mouseout(function()
	{
		var id = $(this).attr('app_id');
		var rating = parseInt($('#rating_string_'+id).attr('rating'));
		rating++;
		for (var i=rating;i<=5;i++)
		{
			$('#rating_' + id + '_' + i).addClass('rating_off');
		}
		for (var i=1;i<rating;i++)
		{
			$('#rating_' + id + '_' + i).removeClass('rating_off');
		}
	});
}

//
// listen for app search results
// and format star ratings
//
$MQL('l:tidev.app.list',function(msg)
{
	// need delay to let rows get into DOM
	setTimeout(function()
	{
		Apps.setupRating(msg.payload['rows']);
		
	},100)
})

//
// Helper function to search for apps
//
Apps.findApps = function(options, search)
{
	if (search==true)
	{
		// use cached values if exist
		switch (options.sort)
		{
			case 'popular':
			{
				if (Apps.popular.length != 0)
				{
					Apps.formatAppRows(Apps.popular);
					return;
				}
				break;
			}
			case 'download':
			{
				if (Apps.download.length != 0)
				{
					Apps.formatAppRows(Apps.download);
					return;
				}
				break;
			}
			case 'recent':
			{
				if (Apps.recent.length != 0)
				{
					Apps.formatAppRows(Apps.recent);
					return;
				}
				break;
			}
		}		
	}
	
	TiDev.invokeCloudService(Apps.app_list_url,{f:'json',mid:Titanium.Platform.id,o:options.sort,q:options.search},'GET',function(result)
	{
		// cache values
		if (search==true)
		{
			if (options.sort == 'popular') Apps.popular = result;
			else if (options.sort == 'download')  Apps.download = result;
			else Apps.recent = result;
		}
		
		Apps.formatAppRows(result);
	});
};

//
// Search Call
//
$MQL('l:app_search',function(msg)
{
	var sort = ($('#sort_most_downloaded').hasClass('active_sort'))?'download':'popular';
	var options = {sort:sort,search:$('#app_search').val()};
	Apps.findApps(options, true);
	TiDev.track('app-search',{search:$('#app_search').val()});
	
})

//
// Format response from App service
//
Apps.formatAppRows = function(json)
{
	var count = json.length;
	var a = [];
	for (var i=0;i<json.length;i++)
	{
		var row = json[i];
		var title = (row.title.length > 18)?row.title.substring(0,17)+'...':row.title;
		var pubdate = TiDev.formatPackagingDate(row.pubdate);
		var desc = row.desc;
		var url = row.url;
		var author = row.author;
		var downloads = row.downloads;
		var value = row.value;
		var votes = row.votes;
		var hasVoted = row.hasVoted;
		var link = row.download_url;
		var guid = row.guid;
		var image = row.image;
		var app_id = row.id
		var app_page = row.app_page
		a.push({'app_page':app_page,image:image,app_id:app_id,guid:guid,title:title,pubdate:pubdate,desc:desc,url:url,author:author,downloads:downloads,value:value,votes:votes,hasVoted:hasVoted,link:link})
		
	}
	if (count == 0)
	{
		// format string
		$('#app_search_string').html('No Apps found.  Please try your search again.');
		
		// hide iterator
		$('#app_list_iterator').css('display','none')
	}
	else
	{
		// format string
		var plural = (count == 1)?'app':'apps';
		$('#app_search_string').html( count + ' ' + plural + ' found');

		// repaint iterator
		//Apps.iterator.execute({rows:a});
		var html = '<div class="infobox appitem">';
		for (var i=0;i<a.length;i++)
		{
			html +='<div class="infobox appitem"><div class="content" style="position:relative;height:178px;">';
			html += '<div class="app_image"><img src="'+a[i].image+'" height="78px" width="78px"/></div>';
			html += '<div class="app_title">';
			html += '<div style="float:left;width:20px">';
			html += '<img src="modules/apps/images/download.png" style="position:relative;top:3px"/>'
			html += '</div>';
			html += '<div style="float:left;width:172px;overflow:hidden">';
			html += '<a href="'+a[i].link+'" target="ti:systembrowser" style="color:white"';
			html += '<span style="text-decoration:underline;">' + a[i].title + '</span></a></div></div>';
			html += '<div class="app_downloads">'+a[i].downloads +' downloads </div>';
		    html += '<div class="app_rating" id="rating_'+a[i].app_id+'">';
			html += '<img app_id="'+a[i].app_id+'" star="1" id="rating_'+a[i].app_id+'_1" guid="'+a[i].guid+'"';
			html += 'class="rating rating_off" src="modules/apps/images/star.png"/>';
			html += '<img app_id="'+a[i].app_id+'" star="2" id="rating_'+a[i].app_id+'_2" guid="'+a[i].guid+'"';
			html += 'class="rating rating_off" src="modules/apps/images/star.png"/>'
			html += '<img app_id="'+a[i].app_id+'" star="3" id="rating_'+a[i].app_id+'_3" guid="'+a[i].guid+'"';
			html += 'class="rating rating_off" src="modules/apps/images/star.png"/>'
			html += '<img app_id="'+a[i].app_id+'" star="4" id="rating_'+a[i].app_id+'_4" guid="'+a[i].guid+'"';
			html += 'class="rating rating_off" src="modules/apps/images/star.png"/>'
			html += '<img app_id="'+a[i].app_id+'" star="5" id="rating_'+a[i].app_id+'_5" guid="'+a[i].guid+'"';
			html += 'class="rating rating_off" 	src="modules/apps/images/star.png"/>';
			html += '</div>'
			html += '<div class="rating_detail">'
			html += '<span class="rating_string" id="rating_string_'+a[i].app_id+'" votes="'+a[i].votes+'"';
			html += 'rating="'+a[i].value+'" hasVoted="'+a[i].hasVoted+'">';
			html += a[i].value+' rating from '+a[i].votes+' votes';
			html += '</span>';
			html += '<span class="rating_string" id="already_voted_'+a[i].app_id+'" style="display:none">';
			html += 'You have already voted!';
			html += '</span>';
			html += '<span class="rating_string" id="voted_success_'+a[i].app_id+'"'; 
			html += 'style="display:none;font-size:11x;color:#809eb3">';
			html += 'Thanks for your vote!';
			html += '</span>';
			html += '</div>';
			html += '<div class="app_author">Published by'; 
			html += '<a href="'+a[i].url+'" target="ti:systembrowser">'+a[i].author+'</a>'; 
			html += '</div>';
			html += '<div class="app_pubdate">Last updated on: '+a[i].pubdate+'</div>'
			html += '<div class="app_url"><a target="ti:systembrowser"" href="'+a[i].app_page+'">App Download Page (all platforms)</a></div>';
			html +=  '<div class="app_description">'+a[i].desc+'</div></div></div></div>';
			
		}

		// send message
		$MQ('l:tidev.app.list',{'rows':a,count:count});

		// set html
		$('#app_list_iterator').html(html);
		
		// show iterator div
		$('#app_list_iterator').css('display','block')

	}

	
};

// $MQL('l:track_app_download',function(msg)
// {
// 	TiDev.track('app-download-click',{url:msg.payload.val});
// 	
// })
// $MQL('l:track_app_author',function(msg)
// {
// 	TiDev.track('app-website-click',{url:msg.payload.val});
// 	
// });
// $MQL('l:track_app_all',function(msg)
// {
// 	TiDev.track('app-weblinks-click',{url:msg.payload.val});
// 	
// });

// register module
TiDev.registerModule({
	name:'apps',
	displayName: 'Apps',
	perspectives:['community'],
	html:'apps.html',
	idx:0,
	active:true,
	callback:Apps.eventHandler
});