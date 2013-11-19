var ipcommon=require('ipcommon');
var nosql=require('nosql');
var sightmap=require('sightmap');
var Article=require('./article');
var Tag=require('./tag');

var IPBlog=module.exports=function(foo,findUser){
	foo.addImportPath(__dirname+'/viewmacros');
	this.db={};
	this.db.articles=nosql.load('articles');
	this.db.polls=nosql.load('polls');
	this.db.pages=nosql.load('pages');
	this.db.tags=nosql.load('tags');

	this.findUser=findUser;

}

IPBlog.prototype.getDatabases=function(){
	return [{name:'articles'},{name:'polls'},{name:'pages'},{name:'tags'}];
}

IPBlog.prototype.getCurPoll=function(callback){
	this.db.polls.all(function(){return true;},function(polls){
		var curPoll;
		for(var p=0;p<polls.length;p++){
			var poll=polls[p];
			if(poll.published){
				curPoll=poll;
				break;
			}
		}
		
		callback(curPoll);
	});
}


function summarize(article){
	var stripped=article.content.replace(/(<([^>]+)>)/ig, '');
	var sentences=stripped.match(/[^\.!\?]+[\.!\?]+/g);
	var summary='';
	var s=0;
	while((summary.length<300)&&(s<sentences.length)){
		summary+=sentences[s]+' ';
		s++;
	}
	return '<p>'+summary+'... <a class="readmorelink" href="'+article.link+'">Read more</a></p>';
}


IPBlog.prototype.getArticlesPage=function(callback,page,pageSize){
	if(page===undefined)page=0;
	if(pageSize===undefined)pageSize=10;

	var self=this;
	var publishedArticles=[];
	this.db.articles.all(function(){return true;},function(articles){
		for(var a=0;a<articles.length;a++){
			var article=articles[a];
			if(article.published){
				article.link='/'+article.url;
				article.summary=summarize(article);
				var user=self.findUser(article.author);
				article.authorName=user.fullName;
				article.authorLink=user.authorLink;
				article.publishDate=new Date(article.publishDate);
				publishedArticles.push(article);
			}
		}
		publishedArticles.sort(function(a,b){
			return b.publishDate-a.publishDate;
		});	
		var numArticles=publishedArticles.length;
		publishedArticles=publishedArticles.filter(function(elem,index){
			if((index>=(page*pageSize)) && (index<(page*pageSize+pageSize)))
				return true;
			else
				return false;
		});

		callback(publishedArticles,numArticles,pageSize);
	});
}

IPBlog.prototype.getTagsPage=function(callback,tagName,page,pageSize){
	if(page===undefined)page=0;
	if(pageSize===undefined)pageSize=10;

	var self=this;
	console.log(arguments);
	this.db.tags.one(function(tag){return (tag.kind==='tag') && (tag.name===tagName);},function(tag){
		if(tag===null){
			callback([],0,pageSize);
			return;
		};
		console.log(tag);
		var publishedArticles=[];
		self.db.articles.all(function(){return true;},function(articles){
			for(var a=0;a<articles.length;a++){
				var article=articles[a];
				if(article.published){
					for(var a2=0;a2<tag.articles.length;a2++){
						if(tag.articles[a2]===article.id){
							article.link='/'+article.url;
							article.summary=summarize(article);
							article.authorName=self.findUser(article.author).fullName;
							article.publishDate=new Date(article.publishDate);
							publishedArticles.push(article);
							break;
						}
					}
				}
			}
			publishedArticles.sort(function(a,b){
				return b.publishDate-a.publishDate;
			});	
			var numArticles=publishedArticles.length;
			publishedArticles=publishedArticles.filter(function(elem,index){
				if((index>=(page*pageSize)) && (index<(page*pageSize+pageSize)))
					return true;
				else
					return false;
			});

			callback(publishedArticles,numArticles,pageSize);
		});
	});

}

IPBlog.prototype.getTags=function(callback){
	this.db.tags.all(function(tag){return tag.kind==='tag';},function(tags){
		for(var t=0;t<tags.length;t++){
			tags[t].link=tags[t].name.replace(/\s/g,'-')+'/';
			tags[t].name=ipcommon.string.toTitleCase(tags[t].name);
		}
		callback(tags);
	});
}


IPBlog.prototype.vote=function(id,voteIndex,callback){
	this.db.polls.update(function(doc){
		try{
			if(doc.id===id){
				doc.votes[voteIndex]++;
				callback(doc);
			}
		}
		catch(e){}//if we throw exception it will be deleted, we do not want that!
		return doc;
	});
}

IPBlog.prototype.getVote=function(id,callback){
	this.db.polls.one(function(doc){return doc.id===id;},function(poll){
		callback(poll);
	});
}

IPBlog.prototype.getArticles=function(callback){
	this.db.articles.all(function(){return true;},function(articles){
		callback(articles);
	});
}


IPBlog.prototype.getPoll=function(id,callback){
	this.db.polls.one(function(doc){return doc.id===id;},function(poll){
		callback(poll);
	});
}

IPBlog.prototype.getPolls=function(callback){
	this.db.polls.all(function(){return true;},function(polls){
		callback(polls);
	});
}


IPBlog.prototype.getArticle=function(id,callback){
	this.db.articles.one(function(doc){return doc.id===id;},function(article){
		callback(article);
	});
}

IPBlog.prototype.getDBPage=function(callback,table,page,pageSize){
	if(pageSize===undefined)pageSize=10;

	var curIndex=0;
	var indexLUT={};
	this.db[table].all(function(item){
		curIndex++;
		if((curIndex>=(page*pageSize+1)) && (curIndex<(page*pageSize+pageSize+1))){
			indexLUT[item.id]=curIndex-1;
			return true;
		}
		else
			return false;
	},function(rows){
		var items=rows.map(function(item){
			return {index:indexLUT[item.id],id:item.id,title:item.title};
		});
		callback(items,curIndex,pageSize);
	});
}


IPBlog.prototype.updateTags=function(category,tags,modifiers,article,callback){
	var self=this;
    function updateList(kind,list,callback){
		function insertNew(index){
			if(index>=list.length)callback();
			else{
				var name=list[index];
				var tag=new Tag(kind,name);
				self.db.tags.all(function(tag){return (tag.kind===kind)&&(tag.name===name);},function(items){
					if(items.length===0){
						//console.log('inserting',tag);
						var t=new Tag(kind,name);
						t.articles.push(article);
						self.db.tags.insert(t,'creating tag '+name);
						insertNew(index+1);
					}
					else{
						//console.log('updating',items);
						self.db.tags.update(function(tag){
							if((tag!==undefined)&&(tag!==null)&&(tag.kind===kind)&&(tag.name===name)){
								var found=false;
								for(var a=0;a<tag.articles.length;a++){
									if(tag.articles[a]===article){
										found=true;
										break;
									}
								}
								if(!found)tag.articles.push(article);
							}
							return tag;
						});
						insertNew(index+1);
					}
				});
			}
		}
		insertNew(0);
	}
	updateList('category',category||[],function(){
		updateList('tag',tags||[],function(){
			updateList('modifier',modifiers||[],function(){
				callback();
			});
		});
	});
}


IPBlog.prototype.getPagination=function(numArticles,pageIndex,pageSize){
	var numPages=Math.ceil(numArticles/pageSize);
	var maxPages=5;
	var pagination=[];
	for(var p=pageIndex-1;p<numPages;p++){
		if(pagination.length>=maxPages)break;
		if(p>=0 && p<numPages){
			pagination.push(p+1);
		}
	}
	return pagination;
}


IPBlog.prototype.generateSitemap=function(baseUrl,callback){
	var self=this;
	var pagesMap=[{loc:baseUrl,changefreq:'daily'}];

	self.db.pages.all(function(doc){return true;},function(pages){
		for(var p=0;p<pages.length;p++){
			pagesMap.push({loc:baseUrl+pages[p].url,changefreq:'monthly'});
		}
		self.db.articles.all(function(doc){return doc.published;},function(articles){
			for(var a=0;a<articles.length;a++){
				pagesMap.push({loc:baseUrl+articles[a].url,changefreq:'weekly'});
			}
			self.getTags(function(tags){
				for(var t=0;t<tags.length;t++){
					pagesMap.push({loc:baseUrl+'tag/'+tags[t].link,changefreq:'daily'});
				}

				sightmap(pagesMap);
			
				callback(sightmap);
			});
		});
	});
}

IPBlog.prototype.getTableItem=function(table,id,callback){
	this.db[table].one(function(doc){return doc.id===id;},function(item){
		callback(item);
	});
}


IPBlog.prototype.deleteTableItem=function(table,id,callback){
	this.db[table].update(function(doc){
		if(doc.id===id)return null;
		return doc;
	});
	callback();
}


IPBlog.prototype.updateTableItem=function(table,id,newItem,callback){
	var self=this;
	self.db[table].all(function(doc){if(doc.id===undefined)return false;return doc.id===id;},function(items){
		if(items.length>0){
			self.db[table].update(function(doc){
				try {// if an exception happens the item will be deleted, we do not want that!
					if(doc.id===id){
						return newItem;
					}
				}
				catch(e){}
				return doc;
			});
		}
		else{
			self.db[table].insert(newItem);
		}
	});
	callback();
}


IPBlog.prototype.updateArticle=function(oldId,title,url,content,author,published,images,titleImage,tags,modifiers,callback){
	var self=this;
	if(oldId){
		self.db.articles.all(function(doc){if(doc.id===undefined)return false;return doc.id===oldId;},function(items){
			if(items.length>0){
				var publishDate=undefined;
				var doc=items[0];
				if((published==='true')&&(doc.published===false))publishDate=new Date();
				else publishDate=doc.publishDate;
				var article=new Article(title,url,content,author,published==='true',publishDate);
				article.images=images;
                article.titleImage=titleImage;
				article.tags=tags;
				article.modifiers=modifiers;
				self.updateTags(undefined,article.tags,article.modifiers,article.id,function(){
					self.db.articles.update(function(doc){
						if(doc.id===oldId){
							return article;
						}
						return doc;
					});

					callback(article.id)
				});
			}
		});
	}
	else{
		var publishDate=undefined;
		if((published==='true')&&(doc.published===false))publishDate=new Date();
		var article=new Article(title,url,content,author,published==='true',publishDate);
		article.images=images;
        article.titleImage=titleImage;
		article.tags=tags;
		article.modifers=modifiers;
		self.updateTags(undefined,article.tags,article.modifiers,article.id,function(){
			newId=article.id;
			self.db.articles.insert(article,'creating article');
			callback(article.id);
		});
	}
}


IPBlog.prototype.deleteArticle=function(id,callback){
	this.deleteTableItem('articles',id,callback);
}


IPBlog.prototype.updatePoll=function(oldId,poll,callback){
	if(oldId){
		this.db.polls.update(function(doc){
			if(doc.id===oldId)return poll;
			return doc;
		});
	}
	else{
		this.db.polls.insert(poll,'creating poll');
	}
}

IPBlog.prototype.deletePoll=function(id,callback){
	this.deleteTableItem('polls',id,callback);
}


IPBlog.prototype.findPageByUrl=function(url,callback){
	var self=this;
	self.db.pages.all(function(doc){if(doc.title===undefined)return false;return (doc.url===url);},function(pages){
		if(pages.length>0) callback(pages[0]);
		else callback();
	});
}

IPBlog.prototype.findArticleByUrl=function(url,callback){
	var self=this;
	self.db.articles.all(function(doc){if(doc.title===undefined)return false;return (doc.url===url);},function(articles){
		if(articles.length>0){
			var article=articles[0];
			var user=self.findUser(article.author);
			article.authorName=user.fullName;
			article.authorLink=user.authorLink;
			article.publishDate=new Date(article.publishDate);
			callback(article);
		}
		else callback();
	});
}
