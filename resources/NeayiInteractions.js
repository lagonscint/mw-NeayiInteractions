﻿/*
 * Copyright (c) 2023 Neayi SAS
 *
 * Permission is hereby granted, free of charge, to any person obtaining a
 * copy of this software and associated documentation files (the "Software"),
 * to deal in the Software without restriction, including without limitation
 * the rights to use, copy, modify, merge, publish, distribute, sublicense,
 * and/or sell copies of the Software, and to permit persons to whom the
 * Software is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
 * DEALINGS IN THE SOFTWARE.
 */

/*@nomin*/

var neayiinteractions_controller = (function () {
	'use strict';

	return {
		baseUrl: null,
		imagepath: null,

		initialize: function () {
			this.baseUrl = window.location.href.split(/[?#]/)[0];
			this.imagepath = mw.config.get('wgExtensionAssetsPath') +
				'/NeayiInteractions/images/';
			if (window.location.hash) {
				var hash = window.location.hash.substring(1);
				var queryIndex = hash.indexOf('?');
				if (queryIndex !== -1) {
					hash = hash.substring(0, queryIndex);
				}
				this.targetComment = hash;
			}

			mw.config.set('mwInternalFollowStatus', mw.config.get('NeayiInteractions').wgInitialFollowedStatus);

			this.setPortal();

			this.setupShareLinks();

			this.setupDivs();

			this.getInitialCounts();

			this.loadStats();
			this.loadCommunity('');

			this.hideOverflownCards();

			console.log("Neayi interactions setup done");
		},

		scrollToAnchor: function (id) {
			var element = $('#' + id);
			if (element.length) {
				$('html,body').animate({ scrollTop: element.offset().top - 50 }, 'slow');
			}
		},

		/**
		 * Look in the page for text and image to be put in the hero
		 */
		setPortal: function () {
			var heroImage = $('img.portail-background');

			if (heroImage.length == 0)
				return;

			var imageSrc = heroImage.first().attr('src');

			$('#firstHeading').hide();
			$('.hero-portail .hero-portail-img img').attr('src', imageSrc);

			$('.hero-portail h1').text($('h1#firstHeading').text());
			$('.hero-portail h2').text($('span.portal-subtitle').text());
			$('.hero-portail').show();
		},

		setupDivs: function () {
			var self = this;
			var pageTitle = mw.config.get('wgTitle') + ' ';
			var relevantPageName = mw.config.get('wgRelevantPageName');
			var views = mw.config.get('NeayiInteractions').wgPageViews;

			this.setupSuggestionBox();

			$('#interaction-title').text(pageTitle);
			$('.title-sticky .sticky-title-span').text(pageTitle);

			if (views > 50)
				$('<span class="page-views"><a href="/wiki/Special:PopularPages">' + views + '<i class="far fa-eye"></i></a></span>').insertAfter($('#interaction-title'));

			// Remove the second edit button that feels weird (source code edition)
			// $('#ca-edit').remove(); (breaks the visual editor!)

			// Copy the page menu in the new interaction bloc on the right
			$('#p-contentnavigation').clone(true).appendTo("#neayi-interaction-desktop-menu").removeAttr('id');

			// Move the original menu in the mobile version of the interaction bloc. Since we now have a copy of this
			// menu, we will remove all the IDs from the children divs, in order to avoir dupplicate IDs.
			// The clone (in the interaction block on the right) will keep its IDs.
			var chameleonMenu = $('#p-contentnavigation').parent();
			$('#p-contentnavigation').appendTo("#neayi-interaction-mobile-menu");
			$('#p-contentnavigation > div').removeAttr('id');
			chameleonMenu.remove();

			// Fix the login/create account links
			$('a.login-links').attr('href', '/index.php?title=Special:Login&returnto=' + relevantPageName);

			// Check if comments are enabled on the page. If not, we disable all interactions.
			var DIConfig = mw.config.get('DiscourseIntegration');
			if (!DIConfig) {
				$('.comments-link').text('').prop('disabled', true);
				$('.interaction-buttons').hide();
				$('.interaction-links').hide();
				$('.interaction-top').hide();
			}
			else {
				// Enable the popover on the question marks in the modals
				$('.popover-neayi-help').popover()

				// Create the dropdown list in the "Je l'ai fait" modal
				const theYear = new Date();
				for (let year = theYear.getFullYear(); year > 2004; year--) {
					$('#sinceInputId').append($('<option>', {
						value: year,
						text: year
					}));
				}

				// Add events on the buttons to trigger the modals and API calls
				this.setupFollowButton($('.neayi-interaction-suivre'));
				this.setupApplauseButton($('.neayi-interaction-applause'));
				this.setupDoneButton($('.neayi-interaction-doneit'));

				this.setupInPageInteractionBloc();
			}

			$( '#load-more-community' ).on('click', function (e) {

				e.preventDefault();
				$( '#load-more-community' ).prop("disabled", true);

				self.loadCommunity($( '#load-more-community' ).attr('href'));
			});

			$( '#communityModal' ).scroll(function(){
				var scrollMoreButton = $('#load-more-community');

				if (!scrollMoreButton.is(":visible") || scrollMoreButton.prop("disabled"))
					return;

				if (scrollMoreButton.offset().top < window.innerHeight)
				{
					// Load another page
					$( '#load-more-community' ).prop("disabled", true);
					self.loadCommunity($( '#load-more-community' ).attr('href'));
				}
			});

			$('select.community-select').on('change', function() {
				self.loadCommunity();
				self.logEvent('statsfilter_select_click', 'Filtre dans la communauté - listes déroulantes', 'community_modal');
			  });

			$('#community-doneit-only').on('change', function() {
				self.loadCommunity();
				self.logEvent('statsfilter_donitonly_click', 'Filtre dans la communauté - uniquement ceux qui l\'ont fait', 'community_modal');
			  });
		},

		/**
		 * Log an event to Google Analytics and facebook
		 * @param String name
		 * @param String label
		 * @param String category
		 */
		logEvent: function(name, label, category) {
			if (typeof gtag === 'function')
			{
				gtag('event', name, {
					'event_label': label,
					'event_category': category
				});
			}

			if (typeof fbq === 'function')
			{
				fbq('trackCustom', name);
			}

			if ((typeof fbq !== 'function') ||
				(typeof gtag !== 'function'))
				console.log('Log event: ' + name + " " + label + " " + category);
		},

		setupShareLinks: function() {
			var mwTitle = mw.config.get('wgTitle');
			var self = this;
			self.share_buttons_animation = 'off';
			self.title_animation = 'off';

			var pageUTM = '';
			if (window.location.href.match(/\?/))
				pageUTM = "&utm_medium=tp_share_button&utm_campaign=share_buttons";
			else
				pageUTM = "?utm_medium=tp_share_button&utm_campaign=share_buttons";

			var facebookURL = encodeURIComponent(window.location.href + pageUTM + "&utm_source=facebook");
			var twitterURL = encodeURIComponent(window.location.href + pageUTM + "&utm_source=twitter");
			var whatsappURL = encodeURIComponent(window.location.href + pageUTM + "&utm_source=whatsapp");

			$('.share-facebook').attr('href', 'https://www.facebook.com/dialog/share?app_id=350418335947147&display=page&href=' + facebookURL)
								.on('click', function (e) {
									self.logEvent('Partage facebook', 'Partage sur facebook', 'share_buttons');
								});
			$('.share-twitter').attr('href', 'https://twitter.com/intent/tweet?text=' + mwTitle + " @TriplePerforma1 " + twitterURL)
								.on('click', function (e) {
									self.logEvent('Partage twitter', 'Partage sur twitter', 'share_buttons');
								});
			$('.share-whatsapp').attr('href', 'whatsapp://send?text=' + mwTitle + " " + whatsappURL)
								.on('click', function (e) {
									self.logEvent('Partage whatsapp', 'Partage sur whatsapp', 'share_buttons');
								});

			if (navigator.share)
			{
				$('.share-share').on('click', function (e) {
					e.preventDefault();
					navigator.share({
						title: mwTitle,
					//	text: 'Hello World',
						url: window.location.href + pageUTM + "&utm_source=native",
					});
					self.logEvent('Partage natif', 'Partage natif', 'share_buttons');
				});
			}
			else
				$('.share-share').remove();

			$(window).scroll(function() {
				if (self.title_animation == 'on')
					return;

				if($(window).scrollTop() > 250)
				{
					self.title_animation = 'on';
					$('.title-sticky').animate({
							opacity: 1,
							top: '0px',
							height: '52px'
						},
						{
							complete: function(){
								self.title_animation = 'off';
							}
						});
				}
				else
				{
					self.title_animation = 'on';
					$('.title-sticky').animate({
							opacity: 0,
							top: '-50px',
							height: 0
						},
						{
							complete: function(){
								self.title_animation = 'off';

							}
						});
				}
			});

			$(window).scroll(function() {
				if (self.share_buttons_animation == 'on')
					return;

				if ($('.social-sticky').length == 0)
					return;

				var threshold = Math.min($('.social-sticky').next().position().top - $(window).height(), 500);

				if($(window).scrollTop() > threshold)
				{
					self.share_buttons_animation = 'on';
					$('.social-sticky').animate({
							opacity: 1,
							height: 'show'
						},
						{
							complete: function(){
								self.share_buttons_animation = 'off';
							}
						});
				}
				else
				{
					self.share_buttons_animation = 'on';
					$('.social-sticky').animate({
							opacity: 0,
							height: 'hide'
						},
						{
							complete: function(){
								self.share_buttons_animation = 'off';
							}
						});
				}
			});
		},

		setupSuggestionBox: function() {
			var self = this;

			$('.suggest-button').on('click', function (e) {
				self.logEvent('Suggestion', 'Click sur le bouton', 'suggestion');
			});
		},

		setupInPageInteractionBloc: function() {

			var wikisearch = $('#app > .wikisearch');
			if (wikisearch.length > 0)
				return;

			if ($('.interaction-bloc-inside').length == 0)
			{
				$('#bodyContent').append($(`<div class="interaction-bloc-inside">
						<div class="interaction-top">
							<p>` + mw.msg('neayiinteractions-footer-text') + `</p>
							<div class="container px-0 interaction-buttons"></div>
						</div>
					</div>`));
			}

			// If there's an interaction bloc inside the page, add the buttons now
			if ($('.interaction-bloc-inside').length > 0)
				$('.interaction-bloc .interaction-buttons .row').clone(true).appendTo(".interaction-bloc-inside .interaction-top .interaction-buttons");
		},

		/**
		 * Get the initial counts from insights
		 */
		getInitialCounts: function () {
			var wikisearch = $('#app > .wikisearch');
			if (wikisearch.length > 0)
				return;

			var self = this;
			var sessionId = mw.config.get('NeayiInteractions').wgUserSessionId;
			var pageId = mw.config.get('wgArticleId');
			var insightsURL = mw.config.get('NeayiInteractions').wgInsightsRootURL;

			var apiToken = mw.config.get('NeayiInteractions').wgUserApiToken;

			var wiki_language = mw.config.get('NeayiInteractions').wgWikiLanguage;

			var headers = {};
			if (apiToken != '')
				headers.Authorization = 'Bearer ' + apiToken;

			$.ajax({
				url: insightsURL + "api/user/page/" + pageId + "?wiki_session_id=" + sessionId + "&wiki=" + wiki_language,
				dataType: 'json',
				method: "GET",
				headers: headers
			}).done(function (data) {
				mw.config.set('mwInteractions', data);

				self.setApplauseLabels();
				self.setFollowersLabels();
				self.setDoneItLabels();
			});
		},

		/**
		 * Load the community from insights
		 */
		loadCommunity: function (url = '') {
			var wikisearch = $('#app > .wikisearch');
			if (wikisearch.length > 0)
				return;

			var self = this;

			var pageId = mw.config.get('wgArticleId');
			var insightsURL = mw.config.get('NeayiInteractions').wgInsightsRootURL;
			var wiki_language = mw.config.get('NeayiInteractions').wgWikiLanguage;

			$.ajax({
				url: insightsURL + "api/page/" + pageId + "/followers?type=follow&wiki=" + wiki_language,
				dataType: 'json',
				method: "GET"
			}).done(function (data) {
				self.addAvatarChain(data.data);
			});

			// Check if connected:
			if (mw.user.isAnon())
			{
				$( '.community-not-connected' ).show();
				$( '.community-connected' ).hide();
				return;
			}

			// https://insights.dev.tripleperformance.fr/api/page/4282/followers?type=do
			// Parameters: type: do | follow, cp, farming_id, cropping_id
			var rootURL = url;
			var bReset = false;

			if (rootURL == '')
			{
				bReset = true;

				var typeOfFollowers = 'follow';
				if ($('#community-doneit-only').prop('checked'))
					typeOfFollowers = "do";

				var dept = '';
				if ($('#departments-select').val())
					dept = '&dept=' + $('#departments-select').val();

				var farming_id = '';
				if ($('#famings-select').val())
					farming_id = '&farming_id=' + $('#famings-select').val();

				var cropping_id = '';
				if ($('#cropping-systems-select').val())
					cropping_id = '&cropping_id=' + $('#cropping-systems-select').val();

				rootURL = insightsURL + "api/page/" + pageId + "/followers?type=" + typeOfFollowers + dept + farming_id + cropping_id + "&wiki=" + wiki_language;
			}

			$.ajax({
				url: rootURL,
				dataType: 'json',
				method: "GET"
			}).done(function (data) {
				self.addCommunityPage(data.data, bReset);

				if (data.current_page != data.last_page)
				{
					rootURL = rootURL.replace(/&page=[0-9]+/, '') + '&page=' + (parseInt(data.current_page, 10) + 1);
					$( '#load-more-community' ).prop("disabled", false).show().attr('href', rootURL);
				}
				else
				{
					$( '#load-more-community' ).hide().attr('href', '');
				}
			});
		},

		/**
		 * On pages with the template "Pages liées", we hide cards over 6 cards, and show a "see more" button
		 */
		hideOverflownCards: function () {

			var self = this;

			$('div.voir-plus').each(function( index ) {
				var buttonParentDiv = $(this);

				var cards = buttonParentDiv.parent().children();

				if (cards.length > 7) // 6 + 1
				{
					for (let index = 6; index < cards.length; index++) {
						var card = $(cards[index]);

						if (card.hasClass('voir-plus'))
							break;

						card.hide();
					}

					// Now add a button to toggle the visibility
					buttonParentDiv.html( `<button type="button" class="btn btn-sm btn-outline-primary voir-plus-button">` +mw.msg('neayiinteractions-see-more')+ `</button>` );
				}
			  });

			// Add an event to those buttons in order to show all the cards now.
			$('button.voir-plus-button').on('click', function (e) {
				self.logEvent('seemore_click', 'Clic sur "Voir plus"', 'page_buttons');

				var buttonParentDiv = $(this).parent();
				var cards = buttonParentDiv.parent().children();
				for (let index = 6; index < cards.length; index++) {
					var card = $(cards[index]);

					if (card.hasClass('voir-plus'))
						break;

					card.show();
				}

				buttonParentDiv.hide();
			});
		},

		/**
		 * Load the stats from insights
		 */
		loadStats: function () {
			var wikisearch = $('#app > .wikisearch');
			if (wikisearch.length > 0)
				return;

			var self = this;
			var pageId = mw.config.get('wgArticleId');
			var insightsURL = mw.config.get('NeayiInteractions').wgInsightsRootURL;
			var wiki_language = mw.config.get('NeayiInteractions').wgWikiLanguage;

			// https://insights.dev.tripleperformance.fr/api/page/4282/stats

			$.ajax({
				url: insightsURL + "api/page/" + pageId + "/stats?wiki=" + wiki_language,
				dataType: 'json',
				method: "GET"
			}).done(function (data) {
				self.setStats(data);
			});
		},

		hasApplaused: function () {
			var interactions = mw.config.get('mwInteractions');

			if (interactions && interactions.state.applause)
				return true;

			return false;
		},

		hasFollowed: function () {
			var interactions = mw.config.get('mwInteractions');

			if (interactions && interactions.state.follow)
				return true;

			return false;
		},

		hasDone: function () {
			var interactions = mw.config.get('mwInteractions');

			if (interactions && interactions.state.done)
				return true;

			return false;
		},

		ajaxInsights: function (actions, done_value = []) {
			var self = this;

			var insightsURL = mw.config.get('NeayiInteractions').wgInsightsRootURL;

			var sessionId = mw.user.sessionId();
			var pageId = mw.config.get('wgArticleId');

			var headers = {};
			var apiToken = mw.config.get('NeayiInteractions').wgUserApiToken;
			var wiki_language = mw.config.get('NeayiInteractions').wgWikiLanguage;

			if (apiToken != '')
				headers.Authorization = 'Bearer ' + apiToken;

			$.ajax({
				url: insightsURL + "api/page/" + pageId + "?wiki_session_id=" + sessionId + "&wiki=" + wiki_language,
				dataType: 'json',
				method: "POST",
				data: {
					interactions: actions,
					done_value: done_value
				},
				headers: headers
			}).done(function (data) {
				mw.config.set('mwInteractions', data);

				self.setApplauseLabels();
				self.setFollowersLabels();
				self.setDoneItLabels();

				self.loadStats();
			});
		},

		/**
		 * Prepare the click event that'll trigger the applause API
		 *
		 * @param jQuery buttons list buttons
		 */
		setupApplauseButton: function (buttons) {
			var self = this;

			buttons.on('click', function (e) {

				self.disableButton(buttons);
				self.logEvent(self.hasApplaused() ? 'unapplaud_click' : 'applaud_click', 'Clic sur "Applaudir"', 'interaction_buttons');

				if (self.hasApplaused())
					self.ajaxInsights(['unapplause']);
				else
					self.ajaxInsights(['applause']);

				e.preventDefault();

				if (mw.user.isAnon()) {
					$('#inviteLoginModal').modal('show');
					return;
				}
			});

		},


		/**
		 * Sets the watch status on the buttons, and prepare the click event that'll trigger the watch API
		 *
		 * @param jQuery buttons list buttons
		 */
		setupFollowButton: function (buttons) {
			var self = this;

			buttons.on('click', function (e) {
				self.logEvent(self.hasFollowed() ? 'unfollow_click' : 'follow_click', 'Clic sur "Suivre"', 'interaction_buttons');

				if (mw.user.isAnon()) {
					$('#requiresLoginModal').modal('show')
					return;
				}

				self.disableButton(buttons);
				var api = new mw.Api();
				var pageId = mw.config.get('wgArticleId');

				if (self.hasFollowed()) {
					self.ajaxInsights(['unfollow']);

					api.post( {
						action: 'diunwatch',
						pageid: pageId,
						token: mw.user.tokens.get( 'csrfToken' )
					} )
					.done( function ( data ) {
						console.log( data );
					} )
					.fail( function ( data ) {
						console.log( "Failed to diunwatch" );
						console.log( data );
					} );
				}
				else {
					self.ajaxInsights(['follow']);

					api.post( {
						action: 'diwatch',
						pageid: pageId,
						token: mw.user.tokens.get( 'csrfToken' )
					} )
					.done( function ( data ) {
						console.log( data );
					} )
					.fail( function ( data ) {
						console.log( "Failed to diwatch" );
						console.log( data );
					} );
				}

				e.preventDefault();
			});

		},

		/**
		 * Prepare the click event that'll trigger the Done API
		 *
		 * @param jQuery buttons list buttons
		 */
		setupDoneButton: function (buttons) {
			var self = this;

			buttons.on('click', function (e) {
				self.logEvent(self.hasDone() ? 'undone_it_click' : 'done_it_click', 'Clic sur "Je l\'ai fait"', 'interaction_buttons');

				if (mw.user.isAnon()) {
					$('#requiresLoginModal').modal('show')
					return;
				}

				self.disableButton(buttons);

				if (self.hasDone()) {
					mw.config.set('mwDoneItStatus', false);
					buttons.prop("disabled", false);

					self.ajaxInsights(['undone']);
				}
				else {
					mw.config.set('mwDoneItStatus', true);
					buttons.prop("disabled", false);

					$('#tellUsMoreModalSubmit').on('click', function (e) {
						e.preventDefault();

						var actions = ['done'];
						if ($('#followwheck').val() == "follow")
						{
							// The user has clicked on the "follow the page" checkbox
							actions = ['done', 'follow'];

							var api = new mw.Api();
							var pageId = mw.config.get('wgArticleId');

							api.post( {
								action: 'cswatch',
								pageid: pageId,
								token: mw.user.tokens.get( 'csrfToken' )
							} )
							.done( function ( data ) {
								console.log( data );
							} )
							.fail( function ( data ) {
								console.log( "Failed to cswatch" );
								console.log( data );
							} );
						}

						var otherparams = {};
						otherparams.start_at = $('#sinceInputId').val() + "-01-01";

						self.ajaxInsights(actions, otherparams);

						$('#tellUsMoreModal').modal('hide');
					});

					self.ajaxInsights(['done']);
					$('#tellUsMoreModal').modal('show');
				}

				e.preventDefault();
			});

		},

		setApplauseLabels: function () {
			var self = this;

			var applauses = 0;
			var interactions = mw.config.get('mwInteractions');

			if (interactions && interactions.counts.applause)
				applauses = interactions.counts.applause;

			if (applauses >= 1000)
				applauses = String(Math.round(applauses / 100) / 10) + " k";
			else if (applauses == 0)
				applauses = "";

			$('.neayi-interaction-applause').html(`<img src="${self.imagepath}clap.svg" width="28">`).prop("disabled", false);
			$('.neayi-interaction-applause-label').text(applauses);
		},

		setFollowersLabels: function () {
			var followers = 0;
			var interactions = mw.config.get('mwInteractions');

			if (interactions && interactions.counts.follow)
				followers = interactions.counts.follow;

			if (followers == 0)
				$( '.neayi-interaction-suivre-label' ).text("");
			else
				$( '.neayi-interaction-suivre-label' ).text(mw.msg('neayiinteractions-interested-count', followers));

			if (followers < 2)
				$( '.rightSide .label-community-count' ).text("");
			else
				$( '.rightSide .label-community-count' ).text(mw.msg('neayiinteractions-community-count', followers));

			if (this.hasFollowed())
				$( '.neayi-interaction-suivre' ).html(`<span style="vertical-align: middle;">` + mw.msg('neayiinteractions-followed') + `</span> <span style="vertical-align: middle;" class="material-icons" aria-hidden="true">check</span>`).prop("disabled", false);
			else
				$( '.neayi-interaction-suivre' ).text(mw.msg('neayiinteractions-follow')).prop("disabled", false);

			// Align the internal mediawiki status with the follow status:
			var currentInternalFollowStatus = mw.config.get('mwInternalFollowStatus');
			if (currentInternalFollowStatus != this.hasFollowed())
			{
				var mwTitle = mw.config.get('wgRelevantPageName');

				if (this.hasFollowed())
				{
					new mw.Api().watch(mwTitle)
						.done(function () {
							mw.config.set('mwInternalFollowStatus', true);
						})
						.fail(function () {
						});
				}
				else
				{
					new mw.Api().unwatch(mwTitle)
						.done(function () {
							mw.config.set('mwInternalFollowStatus', false);
						})
						.fail(function () {
						});
				}
			}
		},

		setDoneItLabels: function () {
			var doers = 0;
			var interactions = mw.config.get('mwInteractions');
			if (interactions && interactions.counts.done)
				doers = interactions.counts.done;

			if (doers == 0)
				doers = "";
			else if (doers >= 1000)
				doers = mw.msg('neayiinteractions-nk-doers', String(Math.round(doers / 100) / 10));
			else
				doers = mw.msg('neayiinteractions-n-doers', doers);

			$( '.neayi-interaction-doneit-label' ).text(doers);

			var labelDone = mw.msg('neayiinteractions-done-it-confirmed'); // "Fait !";
			var labelMarkAsDone = mw.msg('neayiinteractions-I-do-it'); // "Je le fais";

			if ($( '#neayi-type-page' ))
			{
				var typePage = $( '#neayi-type-page' ).text();
				switch (typePage) {
					case 'Production':
						labelDone = mw.msg('neayiinteractions-done-it-confirmed'); // "Fait !";
						labelMarkAsDone = mw.msg('neayiinteractions-I-do-it-production'); // "J'en fais";
						break;

					case 'Ravageur':
						labelDone = mw.msg('neayiinteractions-have-some-confirmed'); // "J'en ai !";
						labelMarkAsDone = mw.msg('neayiinteractions-I-have-some'); // "J'en ai";
						break;

					case 'Matériel':
						labelDone = mw.msg('neayiinteractions-have-it-confirmed'); // "Je l'ai !";
						labelMarkAsDone = mw.msg('neayiinteractions-I-have-it'); // "Je l'ai";
						break;

					default:
						break;
				}

			}

			if (this.hasDone())
				$( '.neayi-interaction-doneit' ).html(`<span style="vertical-align: middle;">${labelDone}</span> <span style="vertical-align: middle;" class="material-icons" aria-hidden="true">beenhere</span>`).prop("disabled", false);
			else
				$( '.neayi-interaction-doneit' ).text(labelMarkAsDone).prop("disabled", false);
		},

		disableButton: function (buttons) {
			buttons.html(`<div class="spinner-border spinner-border-sm" role="status">
							<span class="sr-only">` + mw.msg('neayiinteractions-loading') + `</span>
						 </div>`);
			buttons.prop("disabled", true);
		},

		/**
		 * Parses the result of the ajax call and display the result
		 * @param {*} data
		 */
		 setStats: function (data) {
			var self = this;
			var wiki_language = mw.config.get('NeayiInteractions').wgWikiLanguage;

			self.clearSelect('departments-select');
			self.clearSelect('famings-select');
			self.clearSelect('cropping-systems-select');

			data.department.sort(function(a, b) {
				var a = a.department_number;
				var b = b.department_number;

				// Forza Corsica!
				if (a == '2A' || a== '2B')
					a = 20;

				if (b == '2A' || b == '2B')
					b = 20;

				return a - b;
			  });

			data.department.forEach(item => {

				if (!item.departmentData)
					return;

				self.addOptionToSelect('departments-select', item.departmentData.pretty_page_label + ' (' + item.count + ')', item.department_number);
			});

			// Add the productions
			data.characteristics.farming.forEach(item => {
				self.addOptionToSelect('famings-select', item.pretty_page_label + ' (' + item.count + ')', item.uuid);
			});
			data.characteristics.croppingSystem.forEach(item => {
				self.addOptionToSelect('cropping-systems-select', item.pretty_page_label + ' (' + item.count + ')', item.uuid);
			});

			self.setupDepartmentsStats(data.department);

			// <span id="rex-departement" data-numero="81"></span>
			var currentDept = false;
			if ($("#rex-departement"))
				currentDept = $("#rex-departement").data('numero');

			if (wiki_language == 'fr') {
				self.setupMap(data.department, currentDept);
			}
			self.setupCharacteristicsStats('#famings-stats', data.characteristics.farming);
			self.setupCharacteristicsStats('#cropping-systems-stats', data.characteristics.croppingSystem);

			$( '#communityModal' ).modal('handleUpdate');
		},

		clearSelect: function (selectId, label, value) {
			$("#"+selectId + " option[value != '']").remove();
		},

		addOptionToSelect: function (selectId, label, value) {
			$('#'+selectId).append($( '<option>' ).attr("value", value).text(label));
		},

		/**
		 * Parses the result of the ajax call and display a list of avatars under the buttons
		 * @param {*} data
		 */
		addAvatarChain: function (data) {

			var self = this;

			$('.rightSide .avatars').html('');

			if (data.length < 2)
				return;

			var insightsURL = mw.config.get('NeayiInteractions').wgInsightsRootURL;

			var usersToShow = new Array();
			data.forEach(user => {

				// Ignore ourselves
				if (user['context'] && user['context']['structure'] == 'Triple Performance')
					return;

				// If the avatar is not the default, we add the element at the top of the array
				if (!user['user']['default_avatar'])
					usersToShow.push(user);
				else
					usersToShow.unshift(user);
			});

			if (usersToShow.length < 2)
				return;

			usersToShow.slice(-5).forEach(user => {

				var userdetails = user['user'];

				var avatarURL = insightsURL + 'api/user/avatar/' + userdetails['user_uid'] + '/100';
				var avatarDiv = `<span class="avatar"><img src="${avatarURL}"></span>`;

				$( '.rightSide .avatars' ).append(avatarDiv);
			});
		},

		/**
		 * Parses the result of the ajax call and display the result
		 * @param {*} data
		 */
		addCommunityPage: function (data, bReset) {

			var self = this;

			if (bReset)
				$('#community-items').html('');

			var connectedUserGUID = mw.config.get('NeayiInteractions').wgUserGuid;

			data.forEach(user => {

				if (!user['context'])
					return;

				var context = user['context'];

				if (context['structure'] == 'Triple Performance')
					return;

				var subTitle = context['sector'];
				if (context['structure'] != '')
					subTitle = subTitle + ' (<a href="/wiki/Structure:'+context['structure']+'">'+context['structure']+'</a>)';
				subTitle = '<div class="follower-item-usertitle">' + subTitle + '</div>';

				var interaction = '<span class="status">Le suit</span>';
				if (user['interaction']['done'] == true)
				{
					if (user['interaction']['done_at'] == null)
						interaction = '<span class="status">Le fait</span>';
					else
						interaction = '<span class="status">Le fait depuis ' + user['interaction']['done_at'].substring(0, 4) + '</span>';
				}

				var insightsURL = mw.config.get('NeayiInteractions').wgInsightsRootURL;

				var profileURL = insightsURL + 'tp/' + encodeURI(context['fullname']) +'/' + context['user_uuid'];
				if (connectedUserGUID == context['user_uuid'])
					profileURL = insightsURL + 'profile';

				var avatarURL = insightsURL + 'api/user/avatar/' + context['user_uuid'] + '/100';
				var avatarDiv = `<div class="follower-item-avatar"><img src="${avatarURL}" /></div>`;
				var userName = `<a href="${profileURL}">${context['fullname']}</a>`;
				userName = '<div class="follower-item-username">'+userName + ' ' + interaction+'</div>';

				var characteristicsPlaceholder = `<div class="follower-item-features flex-fill">
														<div class="d-flex flex-wrap justify-content-start caracteristiques-exploitation"></div>
													</div>`;

				var userdiv = $(`<div class="follower-item d-flex flex-wrap">
									${avatarDiv}
									<div class="follower-item-user">${userName} ${subTitle}</div>
									${characteristicsPlaceholder}
								</div>`);

				var features = userdiv.find( 'div.caracteristiques-exploitation' );

				// Add the department
				if (context['department'] != "")
				{
					var depName = context['characteristics_departement'][0].page;
					var depIcon = context['characteristics_departement'][0].icon;
					features.append(self.makeFeature(depName, depName, depIcon));
				}

				// Add the productions
				context['productions'].forEach(element => {
					features.append(self.makeFeature(element['caption'], element['page'], element['icon']));
				});

				context['characteristics'].forEach(element => {
					features.append(self.makeFeature(element['caption'], element['page'], element['icon']));
				});

				$( '#community-items' ).append(userdiv);
			});

			$( '#communityModal' ).modal('handleUpdate');
		},

		makeFeature: function(caption, page, imageURL = '') {

			if (imageURL != '')
			{
				// Make sure the Icon URL ends with /60 for the right width
				if (!imageURL.match(/\/60/))
					imageURL = imageURL + '/60';

				return $( `<div class="caracteristique-exploitation"><p>
							<a href="/wiki/` + page + `" title="` + page + `"><img alt="` + page + `" src="` + imageURL + `" width="60" height="60"></a>
							<span><a href="/wiki/` + page + `" title="` + page + `">` + caption + `</a></span>
						   </p></div>`);
			}
			else
				return $( `<div class="caracteristique-exploitation"><p>
							<span><a href="/wiki/` + page + `" title="` + page + `">` + caption + `</a></span>
						   </p></div>`);
		},

		setupDepartmentsStats: function(deptStats) {
			var self = this;

			deptStats.sort(function(a, b) {
				return b.count - a.count;
			  });

			$( '#departments-stats' ).html('');

			deptStats.slice(0, 5).forEach(function (e, i) {
				$( '#departments-stats' )
					.append( $(`<div class="dept-stat">
									<a href="#" data-dept="${e.department_number}"><span class="count">x ${e.count}</span><span class="dept-name">${e.departmentData.pretty_page_label}</span></a>
								</div>`) );
			});

			$( '#departments-stats a' ).on('click', function (e) {
				e.preventDefault();

				$( '#commununity-tab' ).tab('show');

				var dept = $(this).data('dept');
				$( '#departments-select' ).val(dept).change();

				self.logEvent('statsdept_click', 'Clic sur le département dans la popup', 'community_modal');
			});
		},

		setupCharacteristicsStats: function(divId, characteristicsStats) {
			var self = this;

			characteristicsStats.sort(function(a, b) {
				return b.count - a.count;
			  });

			var insightsURL = mw.config.get('NeayiInteractions').wgInsightsRootURL;

			$( divId + ' .stats-icons' ).html('');

			characteristicsStats.slice(0, 5).forEach(function (e, i) {
				var iconURL = insightsURL + 'api/icon/' + e.uuid + '/90';
				$( divId + ' .stats-icons' )
					.append( $(`<div class="caracteristique-exploitation">
									<div>
										<div><a href="#" data-guid="${e.uuid}" data-type="${e.type}" title="${e.page_label}"><img alt="${e.page_label}" src="${iconURL}"></a></div>
										<div class="label"><a href="#" data-guid="${e.uuid}" data-type="${e.type}" title="${e.page_label}">${e.pretty_page_label}</a></div>
									</div>
									<div class="caracteristique-stat">x ${e.count}</div>
								</div>`) );
			});

			$( '.stats-icons a' ).on('click', function (e) {
				e.preventDefault();

				$( '#commununity-tab' ).tab('show');

				var guid = $(this).data('guid');
				var type = $(this).data('type');

				self.logEvent('statscharacteristics_click', 'Clic sur une caractéristique dans la popup', 'community_modal');

				switch (type) {
					case 'croppingSystem':
						$( '#cropping-systems-select' ).val(guid).change();
						break;

					case 'farming':
						$( '#famings-select' ).val(guid).change();
						break;

					default:
						break;
				}
			});
		},

		/**
		 * Setup the d3js map as inspired from https://www.datavis.fr/index.php?page=map-population
		 * @param {*} deptStats
		 * @package {*} currentDept false or a number of the current dept to highlight
		 */
		setupMap: function(deptStats, currentDept) {
			var self = this;

			var DIConfig = mw.config.get('DiscourseIntegration');
			if (!DIConfig)
				return;

			if ($('#side-map-svg').length > 0)
				return this.refreshMap(deptStats);

			const width = 300, height = 270;
			const path = d3.geoPath();
			const projection = d3.geoConicConformal() // Lambert-93
				.center([2.454071, 46.279229]) // Center on France
				.scale(1500)
				.translate([width / 2, height / 2]);
			path.projection(projection);

			const svg = d3.select('#map').append('svg')
				.attr('id', 'map-svg')
				.attr('width', width)
				.attr('height', height);
			const deps = svg.append('g');

			const sideSvg = d3.select('#side-map-container').append('svg')
				.attr('id', 'side-map-svg')
				.attr('width', width)
				.attr('height', height);
			const sideDeps = sideSvg.append('g');

			var promises = [];
			promises.push(d3.json('/extensions/NeayiInteractions/resources/departments.json'));

			Promise.all(promises).then(function (values) {
				const geojson = values[0]; // Récupération de la première promesse : le contenu du fichier JSON

				deps.selectAll('path')
					.data(geojson.features)
					.enter()
					.append('path')
					.attr('id', d => 'd' + d.properties.CODE_DEPT)
					.attr('d', path);

				sideDeps.selectAll('path')
					.data(geojson.features)
					.enter()
					.append('path')
					.attr('id', d => 'side-d' + d.properties.CODE_DEPT)
					.attr('d', path);

				if (currentDept)
				{
					d3.select('#d' + currentDept)
					  .attr('class', d => 'current')
					  .on('mouseover', function (d) {
						div.transition()
							.duration(200)
							.style('opacity', 1);
						div.html('Département concerné par cette page')
							.style('left', (d3.event.pageX + 30) + 'px')
							.style('top', (d3.event.pageY - 30) + 'px');
					})
					.on('mouseout', function (d) {
						div.style('opacity', 0);
						div.html('')
							.style('left', '-500px')
							.style('top', '-500px');
					});

					d3.select('#side-d' + currentDept)
					  .attr('class', d => 'current')
					  .on('mouseover', function (d) {
						  div.transition()
							  .duration(200)
							  .style('opacity', 1);
						  div.html('Département concerné par cette page')
							  .style('left', (d3.event.pageX + 30) + 'px')
							  .style('top', (d3.event.pageY - 30) + 'px');
					  })
					  .on('mouseout', function (d) {
						  div.style('opacity', 0);
						  div.html('')
							  .style('left', '-500px')
							  .style('top', '-500px');
					  });
				}

				// On calcule le max de la population pour adapter les couleurs
				var quantile = d3.scaleQuantile()
					.domain([0, d3.max(deptStats, e => +e.count)])
					.range(d3.range(9));

				deptStats.forEach(function (e, i) {

					var strClass = 'department q' + quantile(+e.count) + '-9';
					if (currentDept && currentDept == e.department_number)
						strClass = 'department current q' + quantile(+e.count) + '-9';

					d3.select('#d' + e.department_number)
						.attr('class', d => strClass)
						.on('mouseover', function (d) {
							div.transition()
								.duration(200)
								.style('opacity', 1);
							div.html(mw.msg('neayiinteractions-map-departement', e.departmentData.pretty_page_label) + '<br>'
								   + mw.msg('neayiinteractions-map-community-size', e.count) + '<br>')
								.style('left', (d3.event.pageX + 30) + 'px')
								.style('top', (d3.event.pageY - 30) + 'px');
						})
						.on('mouseout', function (d) {
							div.style('opacity', 0);
							div.html('')
								.style('left', '-500px')
								.style('top', '-500px');
						})
						.on('click', function (d) {
							$('#commununity-tab').tab('show');
							$('#departments-select').val(e.department_number).change();

							self.logEvent('statsmap_click', 'Clic sur la carte dans la popup',  'community_modal');
						});

					d3.select('#side-d' + e.department_number)
						.attr('class', d => strClass)
						.on('mouseover', function (d) {
							div.transition()
								.duration(200)
								.style('opacity', 1);
							div.html(mw.msg('neayiinteractions-map-departement', e.departmentData.pretty_page_label ) + '<br>'
								   + mw.msg('neayiinteractions-map-community-size', e.count) + '<br>')
								.style('left', (d3.event.pageX + 30) + 'px')
								.style('top', (d3.event.pageY - 30) + 'px');
						})
						.on('mouseout', function (d) {
							div.style('opacity', 0);
							div.html('')
								.style('left', '-500px')
								.style('top', '-500px');
						})
						.on('click', function (d) {
							$( '#communityModal' ).modal('show');
							$( '#commununity-tab' ).tab('show');
							$( '#departments-select' ).val(e.department_number).change();

							self.logEvent('inpagemap_click', 'Clic sur la carte dans la marge', 'interaction_buttons');
						});
				});
			});

			var div = d3.select('body').append('div')
				.attr('class', 'tooltip')
				.style('opacity', 0);

			$('.side-map-legend').show();
		},

		/**
		 * Setup the d3js map as inspired from https://www.datavis.fr/index.php?page=map-population
		 * @param {*} deptStats
		 */
		refreshMap: function(deptStats) {
			var self = this;
			var wiki_language = mw.config.get('NeayiInteractions').wgWikiLanguage;

			if (wiki_language != 'fr')
				return;

			var DIConfig = mw.config.get('DiscourseIntegration');
			if (!DIConfig)
				return;
			// On calcule le max de la population pour adapter les couleurs
			var quantile = d3.scaleQuantile()
				.domain([0, d3.max(deptStats, e => +e.count)])
				.range(d3.range(9));
			d3.selectAll('#map path')
				.attr('class', '')
				.on('mouseover', null)
				.on('mouseout', null)
				.on('click', null);
			d3.selectAll('#side-map path')
				.attr('class', '')
				.on('mouseover', null)
				.on('mouseout', null)
				.on('click', null);
			deptStats.forEach(function (e, i) {
				d3.select('#d' + e.department_number)
					.attr('class', d => 'department q' + quantile(+e.count) + '-9')
					.on('mouseover', function (d) {
						div.transition()
							.duration(200)
							.style('opacity', 1);
						div.html(mw.msg('neayiinteractions-map-departement', e.departmentData.pretty_page_label ) + '<br>'
							   + mw.msg('neayiinteractions-map-community-size', e.count) + '<br>')
							.style('left', (d3.event.pageX + 30) + 'px')
							.style('top', (d3.event.pageY - 30) + 'px');
					})
					.on('mouseout', function (d) {
						div.style('opacity', 0);
						div.html('')
							.style('left', '-500px')
							.style('top', '-500px');
					})
					.on('click', function (d) {
						$('#commununity-tab').tab('show');
						$('#departments-select').val(e.department_number).change();

						self.logEvent('statsmap_click', 'Clic sur la carte dans la popup', 'community_modal');
					});
				d3.select('#side-d' + e.department_number)
					.attr('class', d => 'department q' + quantile(+e.count) + '-9')
					.on('mouseover', function (d) {
						div.transition()
							.duration(200)
							.style('opacity', 1);
						div.html(mw.msg('neayiinteractions-map-departement', e.departmentData.pretty_page_label ) + '<br>'
							   + mw.msg('neayiinteractions-map-community-size', e.count) + '<br>')
							.style('left', (d3.event.pageX + 30) + 'px')
							.style('top', (d3.event.pageY - 30) + 'px');
					})
					.on('mouseout', function (d) {
						div.style('opacity', 0);
						div.html('')
							.style('left', '-500px')
							.style('top', '-500px');
					})
					.on('click', function (d) {
						$( '#communityModal' ).modal('show');
						$( '#commununity-tab' ).tab('show');
						$( '#departments-select' ).val(e.department_number).change();

						self.logEvent('inpagemap_click', 'Clic sur la carte dans la marge', 'interaction_buttons');
					});
			});
		}
	};
}());

window.NeayiInteractionsController = neayiinteractions_controller;

(function () {
	$(document)
		.ready(function () {
			if (mw.config.exists('NeayiInteractions')) {
				window.NeayiInteractionsController.initialize();
			}
		});
}());

