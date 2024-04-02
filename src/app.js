/*
 * App logic that interacts with Spotify Web API
 * Thanks to https://github.com/plamere/MySavedTracks for example code
 */
(function () {
  "use strict";
  const playlistExport = {
    clientId: "75f6c14b0b174008bcaa9171ae7526f5",
    redirectUri: window.location.href,
    startTime: null,
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
      this.$start = document.getElementById("start");
      this.$dir = document.getElementById("directions");
      this.$progressWrapper = document.querySelector(".progress");
      this.$progress = document.querySelector(".progress-bar");
      this.$output = document.getElementById("output");
    },
    bindEvents: function () {
      this.$authorize.addEventListener("click", this.authorize.bind(this));
      this.$start.addEventListener("click", this.export.bind(this));
    },
    export: async function () {
      const estimateTime = Math.ceil((this.totalPlaylists * this.delayInMs) / 1000 / 60);
      this.startTime = new Date();
      this.addToOutput(`Exporting your playlists to JSON... (est. ${estimateTime} minutes)`);
      this.hide(this.$start);
      this.playlists = await this.getPlaylists(this.nextPageUrl);
      this.show(this.$progressWrapper);
      const toExport = await this.getTracks(this.playlists);
      this.addToOutput(
        `Complete. Exported ${this.totalPlaylists} playlists in ${Math.round(
          (new Date() - this.startTime) / 1000
        )} seconds`
      );
      this.hide(this.$progressWrapper);
      this.exportJSON(toExport);
    },
    handleAuthedUser: async function () {
      this.hide(this.$authorize);
      this.hide(this.$dir);
      const user = await this.fetchCurrentUserProfile();
      if (user) {
        this.show(this.$start);
        this.show(this.$output);
        const playlists = await this.fetchPlaylists();
        if (playlists) {
          this.playlists = this.formatPlaylists(playlists.items);
          this.nextPageUrl = playlists.next;
          this.totalPlaylists = playlists.total;
          this.addToOutput(`Found ${playlists.total} playlists for ${user.id}`);
        }
      } else {
        this.addToOutput("Failed to load Spotify profile");
        console.error("Trouble getting the user profile");
      }
    },
    pageLoad: async function () {
      const args = this.parseArgs();
      if ("access_token" in args) {
        this.accessToken = args["access_token"];
        this.handleAuthedUser();
      } else {
        this.show(this.$authorize);
      }
    },
    formatPlaylists: function (playlists) {
      return playlists.map((playlist) => {
        return {
          name: playlist.name,
          public: playlist.public,
          collaborative: playlist.collaborative,
          trackCount: playlist.tracks.total,
          tracks: playlist.tracks.href,
        };
      });
    },
    authorize: function () {
      const scopes = "user-library-read playlist-read-private";
      const url =
        "https://accounts.spotify.com/authorize?client_id=" +
        this.clientId +
        "&response_type=token" +
        "&scope=" +
        encodeURIComponent(scopes) +
        "&redirect_uri=" +
        encodeURIComponent(this.redirectUri);
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
          Authorization: "Bearer " + this.accessToken,
        },
      });
      if (!res.ok) {
        if (res.status === 429) {
          this.addToOutput(`❌ Rate limit exceeded. Please wait and try again later.`);
        } else if (res.status === 401) {
          window.location.href = this.redirectUri;
        }
      }
      return res.json();
    },
    delay: function (ms) {
      return new Promise((resolve) => setTimeout(resolve, ms));
    },
    addToOutput: function (message) {
      const newMessageElement = document.createElement("p");
      newMessageElement.textContent = message;
      newMessageElement.className = "mb-2 pb-2";
      newMessageElement.style.borderBottom = "1px solid #ccc";
      this.$output.appendChild(newMessageElement);

      this.$output.scrollTop = this.$output.scrollHeight;
    },
    setProgress: function (value) {
      const percent = Math.round((value / this.totalPlaylists) * 100) + "%";
      this.$progress.style.width = percent;
      this.$progress.textContent = `${value} / ${this.totalPlaylists}`;
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
    getPlaylists: async function (url) {
      const playlistsFromAPI = await this.fetchPaginatedData(url);

      const playlists = this.formatPlaylists(playlistsFromAPI);

      return this.playlists.concat(playlists);
    },
    show: function (element) {
      element.style.display = "";
    },
    hide: function (element) {
      element.style.display = "none";
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
    getTracks: async function (playlists) {
      const playlistsWithTracks = [];
      for (let playlist of playlists) {
        this.addToOutput(`${playlist.name} (${playlist.trackCount} tracks)`);
        const tracks = await this.fetchPaginatedData(playlist.tracks);
        playlist.tracks = this.formatTracks(tracks);
        playlistsWithTracks.push(playlist);
        this.setProgress(playlistsWithTracks.length);

        // Delay the next request to avoid hitting the API rate limit
        await this.delay(this.delayInMs);
      }
      return playlistsWithTracks;
    },
    exportJSON: function (playlists) {
      const jsoncontent = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(playlists));
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
