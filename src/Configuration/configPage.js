define(['baseView', 'loading', 'emby-input', 'emby-button', 'emby-textarea', 'emby-select', 'emby-scroller'], function (BaseView, loading) {
    'use strict';

    var pluginId = "6d1c0b3e-4f6a-4c53-9a0e-2b7f1d5c8e41";
    var GB = 1073741824;
    var DEFAULTS = { Months: 24, ExcludedLibraries: '', KeptFolders: '' };

    var columns = [
        { key: 'Name', label: 'Name', get: function (c) { return c.Name; } },
        { key: 'Library', label: 'Library', get: function (c) { return c.Library; } },
        { key: 'SizeBytes', label: 'Size', num: true, get: function (c) { return c.SizeBytes; }, fmt: function (c) { return (c.SizeBytes / GB).toFixed(1) + ' GB'; } },
        { key: 'Items', label: 'Items', num: true, get: function (c) { return c.Items; } },
        { key: 'LastPlayedUtc', label: 'Last played', get: function (c) { return c.LastPlayedUtc || ''; }, fmt: function (c) { return c.LastPlayedUtc ? c.LastPlayedUtc.substr(0, 10) : 'never'; } },
        { key: 'LastPlayedBy', label: 'By', get: function (c) { return c.LastPlayedBy || ''; } },
        { key: 'TotalPlays', label: 'Plays', num: true, get: function (c) { return c.TotalPlays || 0; } },
        { key: 'AddedUtc', label: 'Added', get: function (c) { return c.AddedUtc || ''; }, fmt: function (c) { return (c.AddedUtc || '').substr(0, 10); } }
    ];

    function cell(tag, text, style) {
        var e = document.createElement(tag);
        e.textContent = text;
        if (style) e.style.cssText = style;
        return e;
    }

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

    function filtered(self) {
        var v = self.view;
        var text = v.querySelector('.txtFilter').value.trim().toLowerCase();
        var lib = v.querySelector('.selLibrary').value;
        var played = v.querySelector('.selPlayed').value;
        var col = columns.filter(function (c) { return c.key === self.sortKey; })[0] || columns[2];
        var rows = self.rows.filter(function (c) {
            if (lib && c.Library !== lib) return false;
            if (played === 'never' && c.LastPlayedUtc) return false;
            if (played === 'played' && !c.LastPlayedUtc) return false;
            if (text && (c.Name + ' ' + c.Folder).toLowerCase().indexOf(text) < 0) return false;
            return true;
        });
        rows.sort(function (a, b) {
            var x = col.get(a), y = col.get(b);
            var r = col.num ? x - y : String(x).localeCompare(String(y));
            return self.sortDir * r;
        });
        return rows;
    }

    function render(self) {
        var v = self.view;
        var rows = filtered(self);
        var limit = parseInt(v.querySelector('.selLimit').value, 10);
        var shown = limit ? rows.slice(0, limit) : rows;
        var bytes = rows.reduce(function (s, c) { return s + c.SizeBytes; }, 0);
        var never = rows.filter(function (c) { return !c.LastPlayedUtc; }).length;

        v.querySelector('.divSummary').textContent = rows.length + ' candidate folders, ' + (bytes / GB / 1024).toFixed(2) +
            ' TB total, ' + never + ' never played. Showing ' + shown.length + '.';

        var tbl = v.querySelector('.tblReport');
        tbl.style.display = '';
        tbl.innerHTML = '';
        var head = document.createElement('tr');
        head.appendChild(cell('th', '', 'width:2em'));
        columns.forEach(function (c) {
            var arrow = self.sortKey === c.key ? (self.sortDir > 0 ? ' ▲' : ' ▼') : '';
            var th = cell('th', c.label + arrow, 'text-align:' + (c.num ? 'right' : 'left') + ';padding:.4em .6em;cursor:pointer;white-space:nowrap');
            th.addEventListener('click', function () {
                if (self.sortKey === c.key) self.sortDir = -self.sortDir; else { self.sortKey = c.key; self.sortDir = c.num ? -1 : 1; }
                render(self);
            });
            head.appendChild(th);
        });
        tbl.appendChild(head);

        shown.forEach(function (c) {
            var tr = document.createElement('tr');
            tr.style.cssText = 'cursor:pointer;border-top:1px solid rgba(128,128,128,.25)';
            var cbTd = document.createElement('td');
            var cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.checked = !!self.selected[c.Folder];
            cb.addEventListener('click', function (e) {
                e.stopPropagation();
                if (cb.checked) self.selected[c.Folder] = c.SizeBytes; else delete self.selected[c.Folder];
                updateSelection(self);
            });
            cbTd.appendChild(cb);
            tr.appendChild(cbTd);
            columns.forEach(function (col) {
                tr.appendChild(cell('td', col.fmt ? col.fmt(c) : String(col.get(c)), 'padding:.4em .6em;text-align:' + (col.num ? 'right' : 'left')));
            });
            var detail = document.createElement('tr');
            detail.style.display = 'none';
            var td = cell('td', '', 'padding:.4em .6em 1em;opacity:.85');
            td.colSpan = columns.length + 1;
            var users = (c.Users || []).map(function (u) {
                return u.User + ': ' + u.PlayCount + ' play' + (u.PlayCount === 1 ? '' : 's') + (u.LastPlayedUtc ? ', last ' + u.LastPlayedUtc.substr(0, 10) : '');
            });
            td.appendChild(cell('div', c.Folder, 'word-break:break-all'));
            td.appendChild(cell('div', users.length ? 'Plays: ' + users.join(' | ') : 'No user has ever played this.', 'margin-top:.3em'));
            detail.appendChild(td);
            tr.addEventListener('click', function () { detail.style.display = detail.style.display === 'none' ? '' : 'none'; });
            tbl.appendChild(tr);
            tbl.appendChild(detail);
        });
    }

    function updateSelection(self) {
        var v = self.view, keys = Object.keys(self.selected);
        var bytes = keys.reduce(function (s, k) { return s + self.selected[k]; }, 0);
        v.querySelector('.divSelCount').textContent = keys.length
            ? keys.length + ' folder' + (keys.length === 1 ? '' : 's') + ' selected, ' + (bytes / GB).toFixed(1) + ' GB.'
            : 'Nothing selected.';
        var armed = keys.length > 0 && v.querySelector('.txtConfirm').value === 'DELETE';
        v.querySelector('.btnDelete').disabled = !armed;
    }

    function purge(self, execute) {
        var v = self.view, out = v.querySelector('.preResults');
        var folders = Object.keys(self.selected);
        if (!folders.length) { out.textContent = 'Select at least one row first.'; return; }
        out.textContent = (execute ? 'Deleting' : 'Checking') + ' ' + folders.length + ' folders...';
        loading.show();
        ApiClient.ajax({
            type: 'POST',
            url: ApiClient.getUrl('CleanupCandidates/Purge'),
            data: JSON.stringify({ Folders: folders, Execute: execute }),
            contentType: 'application/json',
            dataType: 'json'
        }).then(function (res) {
            loading.hide();
            var ok = 0, bytes = 0;
            out.textContent = res.map(function (r) {
                if (r.Status === 'deleted' || r.Status === 'would delete') { ok++; bytes += r.SizeBytes; }
                return r.Status.toUpperCase() + '\t' + (r.SizeBytes / GB).toFixed(1) + ' GB\t' + r.Folder + (r.Detail ? '\t' + r.Detail : '');
            }).join('\n') + '\n\n' + ok + ' of ' + res.length + (execute ? ' deleted, ' : ' would be deleted, ') + (bytes / GB).toFixed(1) + ' GB.';
            if (execute) {
                var gone = {};
                res.forEach(function (r) { if (r.Status === 'deleted' || r.Status === 'missing') gone[r.Folder] = true; });
                self.rows = self.rows.filter(function (c) { return !gone[c.Folder]; });
                Object.keys(gone).forEach(function (k) { delete self.selected[k]; });
                v.querySelector('.txtConfirm').value = '';
                render(self);
                updateSelection(self);
            }
        }, function () {
            loading.hide();
            out.textContent = 'The purge request failed. Nothing was reported as deleted; check the Emby server log.';
        });
    }

    function onRun() {
        var self = this, v = this.view;
        var status = v.querySelector('.divStatus');
        status.textContent = 'Scanning the library...';
        loading.show();
        ApiClient.getJSON(ApiClient.getUrl('CleanupCandidates')).then(function (r) {
            loading.hide();
            self.rows = r;
            status.textContent = 'Done. Report generated ' + new Date().toLocaleTimeString() + '.';
            var libs = {};
            r.forEach(function (c) { libs[c.Library] = true; });
            var sel = v.querySelector('.selLibrary');
            sel.innerHTML = '<option value="">All libraries</option>';
            Object.keys(libs).sort().forEach(function (l) {
                var o = document.createElement('option'); o.value = l; o.textContent = l; sel.appendChild(o);
            });
            ['.divFilters', '.divHint', '.btnCsv'].forEach(function (s) { v.querySelector(s).classList.remove('hide'); });
            self.selected = {};
            v.querySelector('.divPurge').classList.remove('hide');
            render(self);
            updateSelection(self);
        }, function () {
            loading.hide();
            status.textContent = 'The report request failed. Check the Emby server log.';
        });
    }

    function onCsv() {
        var q = function (s) { return '"' + String(s == null ? '' : s).replace(/"/g, '""') + '"'; };
        var lines = ['library,name,folder,items,gb,added,last_played,last_played_by,total_plays'].concat(filtered(this).map(function (c) {
            return [c.Library, c.Name, c.Folder, c.Items, (c.SizeBytes / GB).toFixed(2), (c.AddedUtc || '').substr(0, 10),
                (c.LastPlayedUtc || '').substr(0, 10), c.LastPlayedBy || '', c.TotalPlays || 0].map(q).join(',');
        }));
        var blob = new Blob([lines.join('\n')], { type: 'text/csv' });
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'cleanup-candidates.csv';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }

    function View(view, params) {
        BaseView.apply(this, arguments);
        var self = this;
        this.rows = [];
        this.sortKey = 'SizeBytes';
        this.sortDir = -1;
        view.querySelector('.cfgForm').addEventListener('submit', onSubmit.bind(this));
        view.querySelector('.btnRun').addEventListener('click', onRun.bind(this));
        view.querySelector('.btnCsv').addEventListener('click', onCsv.bind(this));
        this.selected = {};
        view.querySelector('.txtConfirm').addEventListener('input', function () { updateSelection(self); });
        view.querySelector('.btnSelectShown').addEventListener('click', function () {
            var limit = parseInt(view.querySelector('.selLimit').value, 10);
            var rows = filtered(self); if (limit) rows = rows.slice(0, limit);
            rows.forEach(function (c) { self.selected[c.Folder] = c.SizeBytes; });
            render(self); updateSelection(self);
        });
        view.querySelector('.btnClearSel').addEventListener('click', function () { self.selected = {}; render(self); updateSelection(self); });
        view.querySelector('.btnDryRun').addEventListener('click', function () { purge(self, false); });
        view.querySelector('.btnDelete').addEventListener('click', function () { purge(self, true); });
        var reset = view.querySelector('.btnReset'), armedTimer;
        reset.addEventListener('click', function () {
            var label = reset.querySelector('span');
            if (!armedTimer) {
                label.textContent = 'Click again to confirm reset';
                armedTimer = setTimeout(function () { label.textContent = 'Reset settings to defaults'; armedTimer = null; }, 5000);
                return;
            }
            clearTimeout(armedTimer); armedTimer = null;
            label.textContent = 'Reset settings to defaults';
            ApiClient.getPluginConfiguration(pluginId).then(function (c) {
                Object.assign(c, DEFAULTS);
                ApiClient.updatePluginConfiguration(pluginId, c).then(function (r) {
                    Dashboard.processPluginConfigurationUpdateResult(r);
                    load(view);
                });
            });
        });
        ['.selLibrary', '.selPlayed', '.selLimit'].forEach(function (s) {
            view.querySelector(s).addEventListener('change', function () { render(self); });
        });
        view.querySelector('.txtFilter').addEventListener('input', function () { render(self); });
    }

    Object.assign(View.prototype, BaseView.prototype);

    View.prototype.onResume = function (options) {
        BaseView.prototype.onResume.apply(this, arguments);
        load(this.view);
    };

    return View;
});
