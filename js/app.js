/*
 * App logic that interacts with Spotify Web API
 * Thanks to https://github.com/plamere/MySavedTracks for example code
 */
(function() {
	var playlistExport = {
		accessToken: null,
		playlistsObjects: [],
		tempPlay: null,
		tracksArray: [],
		init: function() {
			this.cacheDom();
			this.bindEvents();
			this.pageLoad();
		},
		cacheDom: function() {
			this.$authorize = $('#authorize');
			this.$message = $('#message');
			this.$start = $('#start');
			this.$dir = $('#directions');
		},
		bindEvents: function() {
			this.$authorize.on('click', this.authorize.bind(this));
			this.$start.on('click', this.export.bind(this));
		},
		export: function() {
			this.message('Exporting your playlists to JSON...');
			this.$start.hide();
			playlistExport.printPlaylists(playlistExport.tempPlay);
		},
		pageLoad: function() {
			var args = this.parseArgs();
			if ('access_token' in args) {
				accessToken = args['access_token'];
				playlistExport.$authorize.hide();
				playlistExport.$dir.hide();
				this.fetchCurrentUserProfile(function(user) {
					if (user) {
						playlistExport.$start.show();
						playlistExport.fetchPlaylists(function(data) {
							if (data) {
								playlistExport.tempPlay = data;
								playlistExport.message('Found ' + data.total + ' playlists for ' + user.id);
							}
						});
					} else {
						console.error("Trouble getting the user profile");
					}
				});
			} else {
				$('#authorize').show();

			}
		},
		message: function(text) {
			this.$message.text(text);
		},
		authorize: function() {
			var client_id = '75f6c14b0b174008bcaa9171ae7526f5';
			var redirect_uri = 'https://dev.peterfiorella.com/spotifyexport/public/';
			var scopes = 'user-library-read playlist-read-private';
			var url = 'https://accounts.spotify.com/authorize?client_id=' + client_id +
				'&response_type=token' +
				'&scope=' + encodeURIComponent(scopes) +
				'&redirect_uri=' + encodeURIComponent(redirect_uri);
			document.location = url;
		},
		parseArgs: function() {
			var hash = location.hash.replace(/#/g, '');
			var all = hash.split('&');
			var args = {};
			_.each(all, function(keyvalue) {
				var kv = keyvalue.split('=');
				var key = kv[0];
				var val = kv[1];
				args[key] = val;
			});
			return args;
		},
		fetchPlaylists: function(callback) {
			var url = 'https://api.spotify.com/v1/me/playlists';
			this.callSpotify(url, {}, callback);
		},
		fetchCurrentUserProfile: function(callback) {
			var url = 'https://api.spotify.com/v1/me';
			this.callSpotify(url, null, callback);
		},
		callSpotify: function(url, data, callback) {
			$.ajax(url, {
				dataType: 'json',
				data: data,
				async: false,
				headers: {
					'Authorization': 'Bearer ' + accessToken
				},
				success: function(r) {
					callback(r);
				},
				error: function(r) {
					callback(null);
				}
			});
		},
		printPlaylists: function(playlists) {
			_.each(playlists.items, function(item) {
				var name = item.name;
				var songs = item.tracks.total;
				var _play = {
					name: name,
					public: item.public
				};
				var url = item.href + '/tracks';
				//load tracks array
				playlistExport.getTracks(url);
				//assign tracks to playlist obj
				_play.tracks = playlistExport.tracksArray;
				//clear tracks array
				playlistExport.tracksArray = [];
				playlistExport.playlistsObjects.push(_play);
			});

			if (playlists.next) {
				this.callSpotify(playlists.next, {}, function(playlists) {
					playlistExport.printPlaylists(playlists);
				});
			} else {
				this.message('Done!');
				this.exportJSON(this.playlistsObjects);
			}
		},
		getTracks: function(url) {
			playlistExport.callSpotify(url, {}, function(tracks) {
				_.each(tracks.items, function(trk) {
					var artist;
					if (trk.track.artists.length > 1) {
						artist = [];
						_.each(trk.track.artists, function(_art) {
							artist.push(_art.name);
						});
					} else {
						artist = trk.track.artists[0].name;
					}
					var track = {
						name: trk.track.name,
						artist: artist,
						album: trk.track.album.name,
						uri: trk.track.uri
					};
					playlistExport.tracksArray.push(track);
				}); //end each
				if (tracks.next) {
					playlistExport.getTracks(tracks.next);
				}
			}); //end spotify call
		},
		exportJSON: function(playlists) {
			var jsoncontent = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(playlists));
			var dlAnchorElem = document.getElementById('download');
			dlAnchorElem.setAttribute("href", jsoncontent);
			var date = moment().format('YYYY-MM-DD');
			var filename = "spotify-playlists-" + date + ".json";
			dlAnchorElem.setAttribute("download", filename);
			dlAnchorElem.click();
		}
	};
	playlistExport.init();
})()