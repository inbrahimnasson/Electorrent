'use strict';

angular.module('torrentApp').service('configService', ['$rootScope', 'notificationService', 'electron', '$q', 'Server', function($rootScope, $notify, electron, $q, Server) {

    const MenuItem = electron.menuItem
    const config = electron.config;

    var settings = {
        startup: 'default',
        server: {
            ip: '',
            port: '',
            user: '',
            password: '',
            type: '',
        },
        ui: {
            resizeMode: '',
            notifications: true,
            displaySize: 'normal',
            displayCompact: false
        },
        servers: []
    };

    this.initSettings = function() {
        var org = config.settingsReference();
        angular.merge(settings, org)
        settings.servers = settings.servers.map((server) => {
            return new Server(server)
        })
    }

    // Angular wrapper for saving to config
    function put(key, value) {
        var q = $q.defer();
        config.put(key, value, function(err) {
            if(err) q.reject(err)
            else q.resolve();
        });
        return q.promise;
    }

    // Angular wrapper for getting config
    function get(value) {
        return config.get(value);
    }

    function isDefault(server) {
        return server.default === true
    }

    this.appendServer = function(server) {
        settings.servers.push(server)
        this.renderServerMenu()
    }

    this.getAllSettings = function() {
        return settings;
    }

    this.setCurrentServerAsDefault = function() {
        if (!$rootScope.$server) {
            $notify.warning('Can\'t set default server', 'You need to chose a server to set it as default')
        }
        this.setDefault($rootScope.$server)
    }

    this.setDefault = function(server, skipsave) {
        let found = this.getServer(server.id)
        if (!found) return
        settings.servers.forEach(function(value) {
            value.default = false
        })
        found.default = true
        if (!skipsave) {
            this.saveAllSettings().then(() => {
                $notify.ok('Default server saved', 'You default server is now ' + server.getNameAtAddress())
            }).catch(function() {
                $notify.alert('I/O Error', 'Could not save default server. Local configuration file could not be written to?!')
            })
        }
    }

    function settingsToJson() {
        let copy = {}
        angular.copy(settings, copy)
        copy.servers = copy.servers.map((server) => {
            return server.json()
        })
        return copy
    }

    this.saveAllSettings = function(newSettings) {
        var q = $q.defer();
        angular.merge(settings, newSettings)
        config.saveAll(settingsToJson(), function(err) {
            if(err) q.reject(err)
            else q.resolve();
        });
        return q.promise;
    }

    this.saveServer = function(ip, port, user, password, client) {
        if(arguments.length === 1) {
            this.appendServer(arguments[0]);
        } else {
            this.appendServer(new Server(ip, port, user, password, client))
        }
        return this.saveAllSettings()
    }

    this.removeServer = function(server) {
        settings.servers = settings.servers.filter((s) => {
            return s.id !== server.id
        })
        this.renderServerMenu()
    }

    this.updateServer = function(update) {
        let server = this.getServer(update.id);
        if(!server) return $q.reject('Server with id ' + update.id + ' not found')
        angular.merge(server, update)
        return this.saveAllSettings()
    }

    this.getServer = function(id) {
        return settings.servers.find((server) => server.id === id)
    }

    this.getServers = function() {
        return settings.servers
    }

    this.getDefaultServer = function() {
        return settings.servers.find(isDefault)
    }

    this.getRecentServer = function() {
        let maxServer = settings.servers[0]
        settings.servers.forEach(function(server){
            if (server.lastused > maxServer.lastused){
                maxServer = server
            }
        })
        return maxServer
    }

    function getMenu(menu, name) {
        return menu.items.find((menuItem) => menuItem.label === name)
    }

    this.renderServerMenu = function() {
        let menu = electron.menu.getApplicationMenu()
        let serverMenu = getMenu(menu, 'Servers').submenu
        serverMenu.clear()
        serverMenu.append(new MenuItem({
            label: 'Add new server...',
            click: () => $rootScope.$broadcast('add:server'),
        }))
        serverMenu.append(new MenuItem({
            label: 'Set current as default',
            click: () => this.setCurrentServerAsDefault(),
            enabled: !!$rootScope.$server
        }))
        serverMenu.append(new MenuItem({type: 'separator'}))
        renderServerMenuOptions(serverMenu, this.getServers())
        electron.menu.setApplicationMenu(menu)
    }

    function renderServerMenuOptions(menu, servers) {
        if (!$rootScope.$server) {
            menu.append(new MenuItem({
                label: 'Disabled...',
                enabled: false
            }))
            return
        }
        servers.forEach((server) => {
            menu.append(new MenuItem({
                label: server.getNameAtAddress(),
                id: server.id,
                click: () => $rootScope.$broadcast('connect:server', server),
                checked: server.id === $rootScope.$server.id,
                type: 'radio'
            }))
        })
    }

}]);
