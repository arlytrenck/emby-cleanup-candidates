define(['baseView', 'loading', 'emby-input', 'emby-button', 'emby-textarea', 'emby-scroller'], function (BaseView, loading) {
    'use strict';

    var pluginId = "6d1c0b3e-4f6a-4c53-9a0e-2b7f1d5c8e41";
    var GB = 1073741824;

    function load(view) {
        loading.show();
        return ApiClient.getPluginConfiguration(pluginId).then(function (c) {
            view.querySelector('.txtMonths').value = c.Months;
            view.querySelector('.txtExcluded').value = (c.ExcludedLibraries || '').replace(/\|/g, '\n');
            view.querySelector('.txtKept').value = c.KeptFolders || '';
            loading.hide();
        });
    }

    function onSubmit(e) {
        e.preventDefault();
        var view = this.view;
        loading.show();
        ApiClient.getPluginConfiguration(pluginId).then(function (c) {
            c.Months = parseInt(view.querySelector('.txtMonths').value, 10) || 24;
            c.ExcludedLibraries = view.querySelector('.txtExcluded').value;
            c.KeptFolders = view.querySelector('.txtKept').value;
            ApiClient.updatePluginConfiguration(pluginId, c).then(Dashboard.processPluginConfigurationUpdateResult);
        });
        return false;
    }

    function onRun() {
        var self = this, out = this.view.querySelector('.preOut');
        out.textContent = 'Scanning...';
        ApiClient.getJSON(ApiClient.getUrl('CleanupCandidates')).then(function (r) {
            self.rows = r;
            out.textContent = r.map(function (c) {
                return (c.SizeBytes / GB).toFixed(1) + ' GB\t' + c.Items + ' items\t' +
                    (c.LastPlayedUtc ? c.LastPlayedUtc.substr(0, 10) + ' ' + c.LastPlayedBy : 'never') +
                    '\t' + c.Name + '\t[' + c.Library + ']';
            }).join('\n') || 'No candidates.';
        }, function () { out.textContent = 'Request failed.'; });
    }

    function onCsv() {
        var q = function (s) { return '"' + String(s == null ? '' : s).replace(/"/g, '""') + '"'; };
        this.view.querySelector('.preOut').textContent = ['library,name,folder,items,gb,last_played,last_by'].concat((this.rows || []).map(function (c) {
            return [c.Library, c.Name, c.Folder, c.Items, (c.SizeBytes / GB).toFixed(2),
                c.LastPlayedUtc || '', c.LastPlayedBy || ''].map(q).join(',');
        })).join('\n');
    }

    function View(view, params) {
        BaseView.apply(this, arguments);
        this.rows = [];
        view.querySelector('.cfgForm').addEventListener('submit', onSubmit.bind(this));
        view.querySelector('.btnRun').addEventListener('click', onRun.bind(this));
        view.querySelector('.btnCsv').addEventListener('click', onCsv.bind(this));
    }

    Object.assign(View.prototype, BaseView.prototype);

    View.prototype.onResume = function (options) {
        BaseView.prototype.onResume.apply(this, arguments);
        load(this.view);
    };

    return View;
});
