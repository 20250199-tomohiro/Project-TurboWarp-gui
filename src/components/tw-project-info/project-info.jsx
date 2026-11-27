import React from 'react';
import PropTypes from 'prop-types';
import {connect} from 'react-redux';
import JSZip from '@turbowarp/jszip';
import log from '../../lib/log';
import styles from './project-info.css';
const key = id => 'tw:project-info:' + (id || 'pending');
class ProjectInfo extends React.Component {
    constructor (props) {
        super(props);
        let saved = null;
        try {
            saved = JSON.parse(localStorage.getItem(key(props.projectId)) || localStorage.getItem(key('pending')) || 'null');
        } catch (e) {
            saved = null;
        }
        this.state = {instructions: saved ? saved.instructions || '' : props.instructions || '', credits: saved ? saved.credits || '' : props.credits || ''};
        this.changeInstructions = this.changeInstructions.bind(this);
        this.changeCredits = this.changeCredits.bind(this);
        this.exportProject = this.exportProject.bind(this);
        this.handleImportedInfo = this.handleImportedInfo.bind(this);
    }
    componentDidMount () {
        window.addEventListener('tw:project-info-loaded', this.handleImportedInfo);
    }
    componentWillUnmount () {
        window.removeEventListener('tw:project-info-loaded', this.handleImportedInfo);
    }
    handleImportedInfo () {
        try {
            const saved = JSON.parse(localStorage.getItem(key('pending')) || 'null');
            if (saved) this.setState({instructions: saved.instructions || '', credits: saved.credits || ''});
        } catch (e) {
            // Ignore invalid local storage data.
        }
    }
    componentDidUpdate (prevProps) {
        if (prevProps.projectId !== this.props.projectId) this.handleImportedInfo();
    }
    save (field, value) {
        const next = Object.assign({}, this.state, {[field]: value});
        this.setState(next);
        try {
            const data = JSON.stringify({instructions: next.instructions, credits: next.credits});
            localStorage.setItem(key(this.props.projectId), data);
            localStorage.setItem(key('pending'), data);
        } catch (e) {
            // Storage may be unavailable.
        }
    }
    changeInstructions (event) { this.save('instructions', event.target.value); }
    changeCredits (event) { this.save('credits', event.target.value); }
    async exportProject () {
        if (!this.props.vm) return;
        try {
            const zip = await JSZip.loadAsync(this.props.vm.toJSON());
            zip.file('project-info.json', JSON.stringify({instructions: this.state.instructions, credits: this.state.credits}));
            const data = await zip.generateAsync({type: 'blob'});
            const url = URL.createObjectURL(data);
            const link = document.createElement('a');
            link.href = url;
            link.download = 'project.sb3';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        } catch (e) {
            log.error('Could not export project info', e);
        }
    }
    render () {
        return (
            <section className={styles.container}>
                <label className={styles.field}>
                    <span className={styles.heading}>使い方</span>
                    <textarea className={styles.textarea} value={this.state.instructions} onChange={this.changeInstructions} maxLength={10000} placeholder="この作品の遊び方や操作方法を入力してください。" />
                </label>
                <label className={styles.field}>
                    <span className={styles.heading}>メモとクレジット</span>
                    <textarea className={styles.textarea} value={this.state.credits} onChange={this.changeCredits} maxLength={10000} placeholder="制作メモや素材提供者などを入力してください。" />
                </label>
                <div className={styles.actions}><button type="button" onClick={this.exportProject}>SB3ファイルとして保存</button></div>
                <p className={styles.note}>入力内容はこのブラウザに保存されます。ボタンから文章を含むSB3ファイルを書き出せます。</p>
            </section>
        );
    }
}
ProjectInfo.propTypes = {projectId: PropTypes.string, instructions: PropTypes.string, credits: PropTypes.string, vm: PropTypes.shape({toJSON: PropTypes.func})};
const mapStateToProps = state => ({vm: state.scratchGui.vm});
export default connect(mapStateToProps)(ProjectInfo);
