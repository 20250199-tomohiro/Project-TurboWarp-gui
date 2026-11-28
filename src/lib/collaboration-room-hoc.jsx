import PropTypes from 'prop-types';
import React from 'react';

/*
 * Collaboration room controller and status panel.
 * The room's SB3 snapshot is the shared source of truth. Local VM changes are
 * uploaded with optimistic revision checks; remote snapshots are loaded only
 * when there are no unsubmitted local edits.
 */
const collaborationRoomHOC = WrappedComponent => {
    class CollaborationRoom extends React.Component {
        constructor (props) {
            super(props);
            this.state = {
                room: null,
                presence: [],
                error: '',
                notice: '',
                todoText: '',
                busy: false,
                collapsed: false,
                syncing: false,
                revision: null
            };
            this.roomCode = null;
            this.timer = null;
            this.eventCursor = 0;
            this.localDirty = false;
            this.localVersion = 0;
            this.applyingRemote = false;
            this.saveTimer = null;
            this.mounted = false;
            this.handleProjectChanged = this.handleProjectChanged.bind(this);
            this.refresh = this.refresh.bind(this);
            this.pollEvents = this.pollEvents.bind(this);
            this.addTodo = this.addTodo.bind(this);
            this.updateTodo = this.updateTodo.bind(this);
            this.deleteTodo = this.deleteTodo.bind(this);
            this.publishPresence = this.publishPresence.bind(this);
        }
        componentDidMount () {
            this.mounted = true;
            const params = new URLSearchParams(window.location.search);
            this.roomCode = params.get('collab_room');
            if (!this.roomCode || !/^[A-HJ-NP-Z2-9]{6}$/i.test(this.roomCode)) return;
            this.roomCode = this.roomCode.toUpperCase();
            if (this.props.vm) this.props.vm.on('PROJECT_CHANGED', this.handleProjectChanged);
            this.connectRoom();
        }
        componentWillUnmount () {
            this.mounted = false;
            if (this.timer) window.clearInterval(this.timer);
            if (this.saveTimer) window.clearTimeout(this.saveTimer);
            if (this.props.vm) this.props.vm.off('PROJECT_CHANGED', this.handleProjectChanged);
        }
        async request (path, options = {}) {
            const response = await fetch('/api/social/rooms/' + this.roomCode + path, {
                method: options.method || 'GET',
                credentials: 'same-origin',
                headers: {
                    'X-Mirror': '1',
                    ...(options.json !== undefined ? {'Content-Type': 'application/json'} : {}),
                    ...(options.headers || {})
                },
                body: options.json !== undefined ? JSON.stringify(options.json) : options.body
            });
            if (options.binaryResponse) {
                if (!response.ok) {
                    const error = await response.json().catch(() => ({}));
                    throw new Error(error.message || '共有作品を取得できませんでした');
                }
                return response.arrayBuffer();
            }
            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
                const error = new Error(data.message || '共同制作サーバーとの通信に失敗しました');
                error.status = response.status;
                error.data = data;
                throw error;
            }
            return data;
        }
        async connectRoom () {
            try {
                const snapshot = await this.request('/project');
                const bytes = Uint8Array.from(atob(snapshot.data), char => char.charCodeAt(0));
                this.applyingRemote = true;
                await this.props.vm.loadProject(bytes);
                this.applyingRemote = false;
                this.localDirty = false;
                this.eventCursor = 0;
                this.setState({revision: Number(snapshot.revision), notice: '共有プロジェクトに接続しました', error: ''});
                await this.refresh();
                await this.publishPresence();
                this.timer = window.setInterval(() => {
                    this.refresh();
                    this.pollEvents();
                    this.publishPresence();
                }, 2500);
            } catch (error) {
                this.applyingRemote = false;
                this.setState({error: error.message});
            }
        }
        handleProjectChanged () {
            if (!this.roomCode || this.applyingRemote) return;
            this.localDirty = true;
            this.localVersion++;
            this.setState({notice: '変更を同期しています…'});
            if (this.saveTimer) window.clearTimeout(this.saveTimer);
            this.saveTimer = window.setTimeout(() => this.saveLocalProject(), 1200);
        }
        async saveLocalProject () {
            if (!this.mounted || !this.localDirty || !this.props.vm || this.state.syncing) return;
            this.setState({syncing: true, error: ''});
            const versionBeingSaved = this.localVersion;
            try {
                const project = await this.props.vm.saveProjectSb3();
                const response = await this.request('/project', {
                    method: 'PUT',
                    headers: {'Content-Type': 'application/octet-stream', 'X-Collab-Revision': String(this.state.revision)},
                    body: project
                });
                this.localDirty = this.localVersion !== versionBeingSaved;
                this.setState({revision: Number(response.revision), notice: '共有作品を同期しました'});
            } catch (error) {
                if (error.status === 409) {
                    this.setState({
                        error: '他の参加者も同時に変更しました。自分の未同期変更は保持しています。競合を確認してから再同期してください。',
                        notice: '同期競合'
                    });
                } else {
                    this.setState({error: error.message});
                }
            } finally {
                if (this.mounted) {
                    this.setState({syncing: false});
                    if (this.localDirty && !this.state.error) {
                        if (this.saveTimer) window.clearTimeout(this.saveTimer);
                        this.saveTimer = window.setTimeout(() => this.saveLocalProject(), 500);
                    }
                }
            }
        }
        async overwriteWithLocalChanges () {
            try {
                const latest = await this.request('/project');
                this.setState({revision: Number(latest.revision), error: ''}, () => this.saveLocalProject());
            } catch (error) { this.setState({error: error.message}); }
        }
        async discardLocalAndLoadShared () {
            try {
                const snapshot = await this.request('/project');
                const bytes = Uint8Array.from(atob(snapshot.data), char => char.charCodeAt(0));
                this.applyingRemote = true;
                await this.props.vm.loadProject(bytes);
                this.applyingRemote = false;
                this.localDirty = false;
                this.setState({revision: Number(snapshot.revision), error: '', notice: '共有版を読み込みました'});
            } catch (error) { this.applyingRemote = false; this.setState({error: error.message}); }
        }
        async applyRemoteSnapshot () {
            if (this.localDirty || this.state.syncing || !this.props.vm) {
                this.setState({notice: '他の参加者の変更があります。ローカル変更を保存してから反映します。'});
                return;
            }
            const snapshot = await this.request('/project');
            if (Number(snapshot.revision) <= Number(this.state.revision)) return;
            const bytes = Uint8Array.from(atob(snapshot.data), char => char.charCodeAt(0));
            this.applyingRemote = true;
            try {
                await this.props.vm.loadProject(bytes);
                this.setState({revision: Number(snapshot.revision), notice: '他の参加者の変更を反映しました', error: ''});
            } finally {
                this.applyingRemote = false;
            }
        }
        async refresh () {
            if (!this.roomCode || !this.mounted) return;
            try {
                const room = await this.request('');
                const presence = await this.request('/presence');
                if (this.mounted) this.setState({room, presence: presence.participants || [], error: ''});
                await this.request('/heartbeat', {method: 'POST', json: {}});
            } catch (error) {
                if (this.mounted) this.setState({error: error.message});
            }
        }
        async pollEvents () {
            if (!this.roomCode || !this.mounted) return;
            try {
                const result = await this.request('/events?after=' + this.eventCursor);
                const events = result.events || [];
                for (const event of events) {
                    this.eventCursor = Math.max(this.eventCursor, Number(event.id));
                    if (event.account_id !== (this.props.accountId || -1) && event.event_type === 'project-updated') {
                        await this.applyRemoteSnapshot();
                    }
                }
                if (events.some(event => event.event_type.startsWith('todo-'))) await this.refresh();
            } catch (error) {
                if (this.mounted) this.setState({error: error.message});
            }
        }
        async publishPresence () {
            if (!this.roomCode || !this.props.vm) return;
            try {
                const target = this.props.vm.runtime && this.props.vm.runtime.getEditingTarget ?
                    this.props.vm.runtime.getEditingTarget() : null;
                const selected = document.querySelector('.blocklySelected');
                const blockElement = selected && (selected.closest('.blocklyDraggable') || selected.closest('[data-id]'));
                const blockId = blockElement && blockElement.getAttribute('data-id');
                const runtimeBlock = target && target.blocks && target.blocks._blocks && blockId ?
                    target.blocks._blocks[blockId] : null;
                await this.request('/presence', {
                    method: 'PUT',
                    json: {
                        sprite: target && target.getName ? target.getName() : null,
                        target: target && target.id ? target.id : null,
                        blockId: blockId || null,
                        blockType: runtimeBlock && runtimeBlock.opcode ? runtimeBlock.opcode : null,
                        editing: blockId ? 'ブロックを選択中' : 'プロジェクト編集'
                    }
                });
            } catch (error) {
                // Presence is supplementary; keep the editor usable if it fails.
            }
        }
        async leaveRoom () {
            if (!window.confirm('共同制作ルームから退出しますか？')) return;
            try {
                await this.request('/leave', {method: 'DELETE'});
                const url = new URL(window.location.href);
                url.searchParams.delete('collab_room');
                window.location.assign(url.toString());
            } catch (error) {
                this.setState({error: error.message});
            }
        }
        async addTodo (event) {
            event.preventDefault();
            const title = this.state.todoText.trim();
            if (!title) return;
            this.setState({busy: true});
            try {
                await this.request('/todos', {method: 'POST', json: {title}});
                this.setState({todoText: ''});
                await this.refresh();
            } catch (error) {
                this.setState({error: error.message});
            } finally {
                this.setState({busy: false});
            }
        }
        async updateTodo (todo) {
            try {
                await this.request('/todos/' + todo.id, {method: 'PATCH', json: {done: !todo.done}});
                await this.refresh();
            } catch (error) {
                this.setState({error: error.message});
            }
        }
        async deleteTodo (todo) {
            try {
                await this.request('/todos/' + todo.id, {method: 'DELETE'});
                await this.refresh();
            } catch (error) {
                this.setState({error: error.message});
            }
        }
        render () {
            const {room, presence, error, notice, todoText, collapsed, syncing} = this.state;
            return (
                <React.Fragment>
                    <WrappedComponent {...this.props} />
                    {this.roomCode ? (
                        <section style={{
                            position: 'fixed', zIndex: 10000, top: 12, right: 12,
                            width: collapsed ? 190 : 320, maxHeight: 'calc(100vh - 24px)',
                            overflowY: 'auto', boxSizing: 'border-box', padding: 12,
                            borderRadius: 10, background: '#ffffff', color: '#222222',
                            border: '1px solid #cccccc', boxShadow: '0 3px 14px rgba(0,0,0,.2)',
                            fontFamily: 'Arial, sans-serif', fontSize: 13
                        }}>
                            <header style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                                <strong>共同制作 · {this.roomCode}</strong>
                                <div style={{display: 'flex', gap: 4}}>
                                <button type="button" onClick={() => this.leaveRoom()}>退出</button>
                                <button type="button" onClick={() => this.setState({collapsed: !collapsed})}>
                                    {collapsed ? '開く' : '閉じる'}
                                </button>
                                </div>
                            </header>
                            {!collapsed ? (
                                <React.Fragment>
                                    <p aria-live="polite">{syncing ? '同期中…' : notice}</p>
                                    {error ? <p role="alert" style={{color: '#b00020'}}>{error}</p> : null}
                                    {this.localDirty && error ? (
                                        <div style={{display: 'flex', flexWrap: 'wrap', gap: 5}}>
                                            <button type="button" onClick={() => this.overwriteWithLocalChanges()}>自分の変更で共有版を上書き</button>
                                            <button type="button" onClick={() => this.discardLocalAndLoadShared()}>共有版を読み込む（自分の未保存変更を破棄）</button>
                                        </div>
                                    ) : null}
                                    <h4>参加者 ({room && room.members ? room.members.length : 0})</h4>
                                    <ul style={{paddingLeft: 20, margin: '6px 0'}}>
                                        {room && room.members ? room.members.map(member => {
                                            const active = presence.find(person => person.id === member.id);
                                            return <li key={member.id}>{member.username}
                                                {active && active.state && active.state.sprite ? ' — ' + active.state.sprite + ' を編集中' : ''}{active && active.state && active.state.blockType ? '（' + active.state.blockType + '）' : ''}
                                            </li>;
                                        }) : <li>読み込み中...</li>}
                                    </ul>
                                    <h4>共有ToDo</h4>
                                    <form onSubmit={this.addTodo} style={{display: 'flex', gap: 4}}>
                                        <input aria-label="ToDoの内容" value={todoText} maxLength={300}
                                            onChange={event => this.setState({todoText: event.target.value})}
                                            placeholder="新しいToDo" style={{minWidth: 0, flex: 1}} />
                                        <button type="submit" disabled={!todoText.trim() || this.state.busy}>追加</button>
                                    </form>
                                    <ul style={{paddingLeft: 20, margin: '8px 0'}}>
                                        {room && room.todos ? room.todos.map(todo => (
                                            <li key={todo.id} style={{marginBottom: 5}}>
                                                <label style={{overflowWrap: 'anywhere'}}>
                                                    <input type="checkbox" checked={todo.done} onChange={() => this.updateTodo(todo)} />
                                                    <span style={{textDecoration: todo.done ? 'line-through' : 'none'}}>{todo.title}</span>
                                                </label>
                                                <button type="button" aria-label="ToDoを削除" onClick={() => this.deleteTodo(todo)}
                                                    style={{marginLeft: 5}}>削除</button>
                                            </li>
                                        )) : null}
                                    </ul>
                                    <small>参加者・ToDo・編集対象を約2.5秒ごとに更新します。</small>
                                </React.Fragment>
                            ) : null}
                        </section>
                    ) : null}
                </React.Fragment>
            );
        }
    }
    CollaborationRoom.propTypes = {
        children: PropTypes.node,
        vm: PropTypes.object,
        accountId: PropTypes.number
    };
    return CollaborationRoom;
};

export default collaborationRoomHOC;
