/*
 * App logic that interacts with Spotify Web API
 * Thanks to https://github.com/plamere/MySavedTracks for example code
 */
(function () {
  const playlistExport = {
    accessToken: null,
    playlists: [],
    totalPlaylists: 0,
    nextPageUrl: null,
    delayInMs: 500,
    init: function () {
      this.cacheDom();
      this.bindEvents();
      this.pageLoad();
    },
    cacheDom: function () {
      this.$authorize = document.getElementById("authorize");
      this.$message = document.getElementById("message");
      this.$start = document.getElementById("start");
      this.$dir = document.getElementById("directions");
      this.$progress = document.getElementById("progress");
    },
    bindEvents: function () {
      this.$authorize.addEventListener("click", this.authorize.bind(this));
      this.$start.addEventListener("click", this.export.bind(this));
    },
    export: function () {
      const estimateTime = Math.ceil(
        (this.totalPlaylists * this.delayInMs) / 1000 / 60
      );
      this.message(
        `Exporting your playlists to JSON... (eta ${estimateTime} minutes)`
      );
      this.$start.style.display = "none";
      playlistExport.getPlaylists();
    },
    pageLoad: async function () {
      const args = this.parseArgs();
      if ("access_token" in args) {
        accessToken = args["access_token"];
        playlistExport.$authorize.style.display = "none";
        playlistExport.$dir.style.display = "none";
        const user = await this.fetchCurrentUserProfile();
        if (user) {
          playlistExport.$start.style.display = "inline-block";
          const playlists = await playlistExport.fetchPlaylists();
          if (playlists) {
            playlistExport.playlists = this.formatPlaylists(playlists.items);
            this.nextPageUrl = playlists.next;
            console.log(this.playlists);
            this.totalPlaylists = playlists.total;
            playlistExport.message(
              "Found " + playlists.total + " playlists for " + user.id
            );
          }
        } else {
          console.error("Trouble getting the user profile");
        }
      } else {
        this.$authorize.style.display = "inline-block";
      }
    },
    formatPlaylists: function (playlists) {
      return playlists.map((playlist) => {
        return {
          name: playlist.name,
          public: playlist.public,
          collaborative: playlist.collaborative,
          tracks: playlist.tracks.href,
        };
      });
    },
    message: function (text) {
      this.$message.textContent = text;
    },
    authorize: function () {
      const client_id = "75f6c14b0b174008bcaa9171ae7526f5";
      // const redirect_uri =
      //   "https://dev.peterfiorella.com/spotifyexport/public/";
      const redirect_uri = "http://localhost:3000";
      const scopes = "user-library-read playlist-read-private";
      const url =
        "https://accounts.spotify.com/authorize?client_id=" +
        client_id +
        "&response_type=token" +
        "&scope=" +
        encodeURIComponent(scopes) +
        "&redirect_uri=" +
        encodeURIComponent(redirect_uri);
      document.location = url;
    },
    parseArgs: function () {
      const hash = location.hash.replace(/#/g, "");
      const all = hash.split("&");
      const args = {};
      all.forEach((keyvalue) => {
        const kv = keyvalue.split("=");
        const key = kv[0];
        const val = kv[1];
        args[key] = val;
      });
      return args;
    },
    fetchPlaylists: function () {
      const url = "https://api.spotify.com/v1/me/playlists";
      return this.callSpotify(url);
    },
    fetchCurrentUserProfile: function () {
      const url = "https://api.spotify.com/v1/me";
      return this.callSpotify(url);
    },
    callSpotify: async function (url) {
      const res = await fetch(url, {
        headers: {
          Authorization: "Bearer " + accessToken,
        },
      });
      if (!res.ok) {
        if (res.status === 429) {
          // throw new Error("Rate limit exceeded");
          this.message("Rate limit exceeded. Please wait and try again later.");
        }
      }
      return res.json();
    },
    delay: function (ms) {
      return new Promise((resolve) => setTimeout(resolve, ms));
    },
    setProgress: function (value) {
      const percent = (value / this.totalPlaylists) * 100;
      this.$progress.value = percent;
    },
    fetchPaginatedData: async function (url, data = []) {
      try {
        const response = await this.callSpotify(url);
        data = data.concat(response.items);

        if (response.next) {
          return await this.fetchPaginatedData(response.next, data);
        } else {
          return data;
        }
      } catch (e) {
        console.error(e);
      }
    },
    getPlaylists: async function () {
      const playlistsFromAPI = await this.fetchPaginatedData(this.nextPageUrl);

      const playlists = this.formatPlaylists(playlistsFromAPI);

      this.playlists = this.playlists.concat(playlists);
      console.info(`Finished fetching ${this.playlists.length} playlists`);
      console.log(this.playlists);
      this.$progress.style.display = "block";
      console.info(`Fetching playlist tracks`);
      await this.getTracks();
      this.message("Done!");
      this.exportJSON(this.playlists);
    },
    formatTracks: function (tracks) {
      return tracks.map(({ track }) => {
        let artist = track.artists.map((artist) => artist.name);
        if (artist.length === 1) {
          artist = artist[0];
        }
        return {
          name: track.name,
          artist: artist,
          album: track.album.name,
          uri: track.uri,
        };
      });
    },
    getTracks: async function () {
      const playlistsWithTracks = [];
      for (let playlist of this.playlists) {
        // Fetch tracks for the current playlist
        const tracks = await this.fetchPaginatedData(playlist.tracks);
        playlist.tracks = this.formatTracks(tracks);
        playlistsWithTracks.push(playlist);
        this.setProgress(playlistsWithTracks.length);
        // Delay the next request to avoid hitting the API rate limit
        await this.delay(this.delayInMs); // Adjust delay time as required by the rate limit
      }

      this.playlists = playlistsWithTracks;
    },
    exportJSON: function (playlists) {
      const jsoncontent =
        "data:text/json;charset=utf-8," +
        encodeURIComponent(JSON.stringify(playlists));
      const dlAnchorElem = document.getElementById("download");
      dlAnchorElem.setAttribute("href", jsoncontent);
      const date = this.formatDate();
      const filename = "spotify-playlists-" + date + ".json";
      dlAnchorElem.setAttribute("download", filename);
      dlAnchorElem.click();
    },
    formatDate: function () {
      const date = new Date();

      let year = date.getFullYear();
      let month = date.getMonth() + 1;
      let day = date.getDate();

      // Ensure month and day are two digits
      month = month < 10 ? "0" + month : month;
      day = day < 10 ? "0" + day : day;

      return `${year}-${month}-${day}`;
    },
  };
  playlistExport.init();
})();
