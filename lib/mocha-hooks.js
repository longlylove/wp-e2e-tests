/** @format */

import config from 'config';
import * as slackNotifier from './slack-notifier';

import * as mediaHelper from './media-helper';

import * as driverManager from './driver-manager';
import * as driverHelper from './driver-helper';
import * as videoRecorder from '../lib/video-recorder';

const afterHookTimeoutMS = config.get( 'afterHookTimeoutMS' );
let allPassed = true; // For SauceLabs status

// Start xvfb display and recording
before( async function() {
	await videoRecorder.startDisplay();
} );

// Start xvfb display and recording
before( async function() {
	await videoRecorder.startVideo();
} );

// Sauce Breakpoint
afterEach( function() {
	const driver = global.__BROWSER__;

	if (
		process.env.SAUCEDEBUG &&
		this.currentTest.state === 'failed' &&
		config.has( 'sauce' ) &&
		config.get( 'sauce' )
	) {
		driver.executeScript( 'sauce: break' );
	}
} );

// Take Screenshot
afterEach( function() {
	this.timeout( afterHookTimeoutMS );
	if ( ! this.currentTest ) {
		return;
	}
	allPassed = allPassed && this.currentTest.state === 'passed';

	const driver = global.__BROWSER__;
	const shortTestFileName = this.currentTest.title.replace( /[^a-z0-9]/gi, '-' ).toLowerCase();
	const shortDescribeFileName = this.currentTest
		.fullTitle()
		.replace( /.*\)/gi, '' )
		.replace( /\@.*/gi, '' )
		.replace( /[^a-z0-9]/gi, '-' )
		.toLowerCase();

	const screenSize = driverManager.currentScreenSize().toUpperCase();
	const locale = driverManager.currentLocale().toUpperCase();
	const date = new Date().getTime().toString();
	let filenameCallback;

	if ( this.currentTest.state === 'failed' ) {
		let neverSaveScreenshots = config.get( 'neverSaveScreenshots' );
		if ( neverSaveScreenshots ) {
			return null;
		}

		driver.getCurrentUrl().then(
			url => console.log( `FAILED: Taking screenshot of: '${ url }'` ),
			err => {
				slackNotifier.warn( `Could not capture the URL when taking a screenshot: '${ err }'` );
			}
		);

		filenameCallback = () => `FAILED-${ locale }-${ screenSize }-${ shortTestFileName }-${ date }`;
	} else if ( config.get( 'saveAllScreenshots' ) === true ) {
		filenameCallback = () =>
			`${ locale }-${ screenSize }-${ shortDescribeFileName }-${ date }-${ shortTestFileName }`;
	} else {
		return;
	}

	return driver.takeScreenshot().then(
		data => {
			return driver.getCurrentUrl().then( url => {
				return mediaHelper.writeScreenshot( data, filenameCallback, { url } );
			} );
		},
		err => {
			slackNotifier.warn( `Could not take screenshot due to error: '${ err }'` );
		}
	);
} );

// Dismiss any alerts for switching away
afterEach( function() {
	this.timeout( afterHookTimeoutMS );
	const driver = global.__BROWSER__;

	if (
		this.currentTest &&
		this.currentTest.state === 'failed' &&
		( config.get( 'closeBrowserOnComplete' ) === true || global.isHeadless === true )
	) {
		driverManager.dismissAllAlerts( driver );
	}
} );

// Check for console errors
afterEach( function() {
	this.timeout( afterHookTimeoutMS );
	const driver = global.__BROWSER__;
	return driverHelper.checkForConsoleErrors( driver );
} );

// Update Sauce Job Status locally
afterEach( function() {
	const driver = global.__BROWSER__;

	if ( config.has( 'sauce' ) && config.get( 'sauce' ) ) {
		driver.allPassed = driver.allPassed && this.currentTest.state === 'passed';
	}
} );

// Stop video recording if the test has failed
afterEach( async function() {
	if ( this.currentTest && this.currentTest.state === 'failed' ) {
		await videoRecorder.stopVideo( this.currentTest );
	}
} );

// Push SauceLabs job status update (if applicable)
after( function() {
	this.timeout( afterHookTimeoutMS );
	const driver = global.__BROWSER__;

	if ( config.has( 'sauce' ) && config.get( 'sauce' ) ) {
		driver.executeScript( 'sauce:job-result=' + driver.allPassed );
	}
} );

// Quit browser
after( function() {
	this.timeout( afterHookTimeoutMS );
	const driver = global.__BROWSER__;

	if (
		( config.has( 'sauce' ) && config.get( 'sauce' ) ) ||
		config.get( 'closeBrowserOnComplete' ) === true ||
		global.isHeadless === true
	) {
		return driverManager.quitBrowser( driver );
	}
} );

// Stop video
after( async function() {
	await videoRecorder.stopVideo();
} );

// Stop xvfb display
after( async function() {
	await videoRecorder.stopDisplay();
} );
