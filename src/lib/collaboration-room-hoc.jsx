import PropTypes from 'prop-types';
import React from 'react';

/*
 * Small collaboration-room panel.
 * The server remains the source of truth for room membership and shared ToDos.
 * Project snapshot synchronization is handled separately from this UI.
 */
const collaborationRoomHOC = WrappedComponent => {
    class CollaborationRoom extends React.Component {
        constructor (props) {
            super(props);
            this.state = {
                room: null,
                error: '',
                todoText: '',
                busy: false,
                collapsed: false
            };
            this.refreshTimer = null;
            this.roomCode = null;
            this.refresh = this.refresh.bind(this);
            this.addTodo = this.addTodo.bind(this);
            this.updateTodo = this.updateTodo.bind(this);
            this.deleteTodo = this.deleteTodo.bind(this);
        }
        componentDidMount () {
            const params = new URLSearchParams(window.location.search);
            this.roomCode = params.get('collab_room');
            if (this.roomCode && /^[A-HJ-NP-Z2-9]{6}$/i.test(this.roomCode)) {
                this.refresh();
                this.refreshTimer = window.setInterval(this.refresh, 4000);
            }
        }
        componentWillUnmount () {
            if (this.refreshTimer) window.clearInterval(this.refreshTimer);
        }
        async request (path, options = {}) {
            const response = await fetch('/api/social/rooms/' + this.roomCode + path, {
                method: options.method || 'GET',
                credentials: 'same-origin',
                headers: {
                    'X-Mirror': '1',
                    ...(options.body !== undefined ? {'Content-Type': 'application/json'} : {})
                },
                body: options.body !== undefined ? JSON.stringify(options.body) : undefined
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(data.message || '共同制作サーバーとの通信に失敗しました');
            return data;
        }
        async refresh () {
            if (!this.roomCode || this.state.busy) return;
            try {
                const room = await this.request('');
                this.setState({room, error: ''});
                await this.request('/heartbeat', {method: 'POST', body: {}});
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
                await this.request('/todos', {method: 'POST', body: {title}});
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
                await this.request('/todos/' + todo.id, {method: 'PATCH', body: {done: !todo.done}});
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
            const {room, error, todoText, collapsed} = this.state;
            return (
                <React.Fragment>
                    <WrappedComponent {...this.props} />
                    {this.roomCode ? (
                        <section style={{
                            position: 'fixed',
                            zIndex: 10000,
                            top: 12,
                            right: 12,
                            width: collapsed ? 190 : 300,
                            maxHeight: 'calc(100vh - 24px)',
                            overflowY: 'auto',
                            boxSizing: 'border-box',
                            padding: 12,
                            borderRadius: 10,
                            background: '#ffffff',
                            color: '#222222',
                            border: '1px solid #cccccc',
                            boxShadow: '0 3px 14px rgba(0,0,0,.2)',
                            fontFamily: 'Arial, sans-serif',
                            fontSize: 13
                        }}>
                            <header style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                                <strong>共同制作 · {this.roomCode}</strong>
                                <button type="button" onClick={() => this.setState({collapsed: !collapsed})}>
                                    {collapsed ? '開く' : '閉じる'}
                                </button>
                            </header>
                            {!collapsed ? (
                                <React.Fragment>
                                    {error ? <p role="alert" style={{color: '#b00020'}}>{error}</p> : null}
                                    <h4>参加者 ({room && room.members ? room.members.length : 0})</h4>
                                    <ul style={{paddingLeft: 20, margin: '6px 0'}}>
                                        {room && room.members ? room.members.map(member => (
                                            <li key={member.id}>{member.username}</li>
                                        )) : <li>読み込み中...</li>}
                                    </ul>
                                    <h4>共有ToDo</h4>
                                    <form onSubmit={this.addTodo} style={{display: 'flex', gap: 4}}>
                                        <input
                                            aria-label="ToDoの内容"
                                            value={todoText}
                                            maxLength={300}
                                            onChange={event => this.setState({todoText: event.target.value})}
                                            placeholder="新しいToDo"
                                            style={{minWidth: 0, flex: 1}}
                                        />
                                        <button type="submit" disabled={!todoText.trim()}>追加</button>
                                    </form>
                                    <ul style={{paddingLeft: 20, margin: '8px 0'}}>
                                        {room && room.todos ? room.todos.map(todo => (
                                            <li key={todo.id} style={{marginBottom: 5}}>
                                                <label style={{overflowWrap: 'anywhere'}}>
                                                    <input
                                                        type="checkbox"
                                                        checked={todo.done}
                                                        onChange={() => this.updateTodo(todo)}
                                                    />
                                                    <span style={{textDecoration: todo.done ? 'line-through' : 'none'}}>
                                                        {todo.title}
                                                    </span>
                                                </label>
                                                <button
                                                    type="button"
                                                    aria-label="ToDoを削除"
                                                    onClick={() => this.deleteTodo(todo)}
                                                    style={{marginLeft: 5}}
                                                >削除</button>
                                            </li>
                                        )) : null}
                                    </ul>
                                    <small>参加者とToDoは約4秒ごとに更新されます。</small>
                                </React.Fragment>
                            ) : null}
                        </section>
                    ) : null}
                </React.Fragment>
            );
        }
    }
    CollaborationRoom.propTypes = {
        children: PropTypes.node
    };
    return CollaborationRoom;
};

export default collaborationRoomHOC;
