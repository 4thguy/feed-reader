'use strict';

angular
	.module('4thguy.feedReader')
	.constant('feedData', {
	    updateIntervalMinutes: 1
	})
	.service('feedTimer', function ($rootScope, feedData) {
	    var reset = function (newMinuteValue) {
		var oldMinuteValue = feedData.updateIntervalMinutes;
		if (newMinuteValue !== oldMinuteValue) {
		    feedData.updateIntervalMinutes = newMinuteValue || feedData.updateIntervalMinutes;
		    $rootScope.$broadcast('updateTimerMax', newMinuteValue, oldMinuteValue);
		}
	    };

	    reset(30);

	    $rootScope.$on('changeUpdateInterval', function (angularObject, newValue) {
		reset(newValue);
	    });

	    return {
		data: feedData,
		reset: reset
	    };
	})
	.service('feedTimeout', function ($rootScope, $timeout, feedTimer) {
	    var remainingTime = 0;

	    function resetTick() {
		remainingTime = feedTimer.data.updateIntervalMinutes;
	    }

	    function tick() {
		remainingTime -= 1;
		if (remainingTime <= 0) {
		    resetTick();
		    $rootScope.$broadcast('fetchAll');
		}
		$rootScope.$broadcast('updateTimer', remainingTime);
		$timeout(function () {
		    tick();
		}, 60000);
	    }

	    resetTick();
	    tick();

	    $rootScope.$on('updateTimerMax', function (newValue, oldValue) {
		if (oldValue > newValue) {
		    remainingTime = 0;
		} else {
		    remainingTime = newValue - remainingTime || 0;
		}
	    });

	    return {
		currentTimer: remainingTime,
		timerLength: feedTimer.data.updateIntervalMinutes
	    };
	})
	.controller('progressBarCtrl', function ($rootScope, $scope, feedTimeout) {
	    $scope.value = 1;
	    $scope.max = 30;

	    $rootScope.$on('updateTimer', function (angularObject, remainingTime) {
		$scope.value = $scope.max - remainingTime;
	    });
	    $rootScope.$on('updateTimerMax', function (angularObject, newMaxTime) {
		$scope.max = newMaxTime;
	    });
	})
	.constant('updateIntervals', [{
		name: '30 minutes',
		value: 30
	    }, {
		name: '1 hour',
		value: 60
	    }, {
		name: '2 hours',
		value: 120
	    }
	])
	.controller('updateIntervalCtrl', function ($rootScope, $scope, updateIntervals) {
	    $scope.options = updateIntervals;
	    $scope.selectedOption = updateIntervals[0];

	    $scope.$on('selectOption', function (angularObject, optionId) {
		$scope.selectedOption = updateIntervals[optionId];
		$rootScope.$broadcast('changeUpdateInterval', $scope.selectedOption.value);
	    });
	});
