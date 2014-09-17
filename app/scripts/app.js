'use strict';
Array.prototype.remove = function (from, to) {
    var rest = this.slice((to || from) + 1 || this.length);
    this.length = from < 0 ? this.length + from : from;
    return this.push.apply(this, rest);
};

var nextArticleId = 0;
function Article(data, source) {
    nextArticleId++;
    return {
	id: nextArticleId,
	source: source || 'unknown',
	link: data.link,
	title: data.title,
	author: data.author,
	publishedDate: new Date(data.publishedDate),
	contentSnippet: data.contentSnippet,
	originalData: data,
	lazyInit: Article.prototype.lazyInit
    };
}
Article.prototype.lazyInit = function () {
    if (typeof (this.styling) === 'undefined') {
	this.styling = {
	    backgroundColor: Please.make_color(),
	    backgroundImage: 'url(' + getFirstImageUrlFromHtml(this.originalData.content) + ')'
	};
    }
};

function locationOfInverse(element, array, property, start, end) {
    start = start || 0;
    end = end || array.length;
    var pivot = parseInt(start + (end - start) / 2);
    var pivotValue = array[pivot][property];
    var elementValue = element[property];
    if (pivotValue === elementValue) {
	return pivot;
    }
    if (end - start <= 1) {
	if (pivotValue > elementValue) {
	    return pivot;
	}
	return pivot - 1;
    }
    if (pivotValue > elementValue) {
	return locationOfInverse(element, array, property, pivot, end);
    }
    return locationOfInverse(element, array, property, start, pivot);
}

function getFirstImageUrlFromHtml(html) {
    var reducedArray = html.match('<img(.*)>');
    if (reducedArray !== null) {
	var reducedString = reducedArray[0];
	var to = reducedString.match('src="') || '';
	reducedString = to.input.substr(to.index + 5);
	to = reducedString.match('"');
	reducedString = to.input.substr(0, to.index);

	return reducedString || '';
    }
    return '';
}
angular
	.module('4thguy.feedReader', [
	    'infinite-scroll'
	])
	.service('feedList', function () {
	    function save() {
		localStorage.setItem('feedList', JSON.stringify(feeds));
	    }
	    function restore() {
		return JSON.parse(localStorage.getItem('feedList'));
	    }

	    var feeds = restore();
	    if (feeds === null) {
		feeds = [
		    'http://feeds.mashable.com/Mashable',
		    'http://feeds.wired.com/wired/index'
		];
		save();
	    }

	    return {
		add: function (url) {
		    feeds.push(url);
		    save();
		},
		remove: function (url) {
		    feeds.remove(url);
		    save();
		},
		get: function () {
		    return feeds;
		}
	    };
	})
	.service('sourceFeed', function () {
	    return {};
	})
	.service('articleFeed', function () {
	    return [];
	})
	.factory('dataStorageManager', function (articleFeed, sourceFeed) {
	    function makeSureArticleSourceExists(source) {
		if (typeof (sourceFeed[source]) === 'undefined') {
		    sourceFeed[source] = {};
		}
	    }
	    function isArticleAlreadyListed(source, link) {
		makeSureArticleSourceExists(source);
		return typeof (sourceFeed[source][link]) !== 'undefined';
	    }

	    return {
		addArticle: function (article, source) {
		    if (!isArticleAlreadyListed(source, article.link)) {
			sourceFeed[source][article.link] = article;
			if (articleFeed.length === 0) {
			    articleFeed.push(article);
			} else {
			    var placeAfter = locationOfInverse(article, articleFeed, 'publishedDate');
			    articleFeed.splice(placeAfter + 1, 0, article);
			}
		    }
		},
		removeSource: function (source) {
		    if (typeof (sourceFeed[source]) !== 'undefined') {
			angular.forEach(sourceFeed[source], function (article) {
			    var position = articleFeed.indexOf(article);
			    articleFeed.remove(position);
			});
			sourceFeed[source] = {};
		    }
		},
		isArticleAlreadyListed: isArticleAlreadyListed
	    };
	})
	.factory('feedParser', function ($timeout, dataStorageManager) {
	    var parse = function (feed) {
		angular.forEach(feed.entries, function (feedItem) {
		    if (!dataStorageManager.isArticleAlreadyListed(feed.feedUrl, feedItem.link)) {
			var newArticle = new Article(feedItem, feed.title);
			dataStorageManager.addArticle(newArticle, feed.feedUrl);
		    }
		});
	    };
	    return {
		parse: parse
	    };
	})
	.constant('feedFetcherConfig', {
	    v: '1.0',
	    num: -1,
	    output: 'json',
	    scoring: 'h',
	    callback: 'JSON_CALLBACK'
	})
	.factory('feedFetcher', function ($http, feedFetcherConfig, feedParser) {
	    var service = 'https://ajax.googleapis.com/ajax/services/feed/load?';

	    angular.forEach(feedFetcherConfig, function (data, property) {
		service = service + property + '=' + data + '&';
	    });
	    service += 'q=';

	    return {
		fetch: function (address) {
		    $http
			    .jsonp(service + address)
			    .success(function (response) {
				if (response.responseStatus === 200) {
				    feedParser.parse(response.responseData.feed);
				}
			    })
			    .error(function (error) {
				console.log(error);
			    });
		}
	    };
	})
	.factory('feedFetchAll', function ($rootScope, feedList, feedFetcher) {
	    var fetchAll = function () {
		angular.forEach(feedList.get(), function (address) {
		    feedFetcher.fetch(address);
		});
	    };

	    $rootScope.$on('fetchAll', function () {
		fetchAll();
	    });

	    return {
		fetchAll: fetchAll
	    };
	})
	.controller('feedCtrl', function ($scope, dataStorageManager, feedFetcher, feedList) {
	    $scope.feedList = feedList.get();

	    $scope.$on('addFeed', function (angularObject, newAddress) {
		if (newAddress !== '') {
		    feedFetcher.fetch(newAddress);
		    feedList.add(newAddress);
		}
		$scope.newAddress = '';
	    });
	    $scope.$on('removeFeed', function (angularObject, addressLocation) {
		dataStorageManager.removeSource($scope.feedList[addressLocation]);
		feedList.remove(addressLocation);
	    });
	})
	.controller('feedScroller', function ($scope, feedList, articleFeed, feedFetchAll) {
	    $scope.articles = articleFeed;
	    $scope.articleCountLimit = 0;

	    feedFetchAll.fetchAll();

	    $scope.scrolledToBottom = function () {
		$scope.articleCountLimit += 10;
		if ($scope.articleCountLimit > $scope.articles.length) {
		    $scope.articleCountLimit = $scope.articles.length;
		}
		if ($scope.articleCountLimit < 10) {
		    $scope.articleCountLimit = 10;
		}
	    };
	});
