import React from 'react';
import PropTypes from 'prop-types';
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
    }
    componentDidUpdate (prevProps) {
        if (prevProps.projectId !== this.props.projectId) {
            try {
                const saved = JSON.parse(localStorage.getItem(key(this.props.projectId)) || localStorage.getItem(key('pending')) || 'null');
                if (saved) this.setState({instructions: saved.instructions || '', credits: saved.credits || ''});
            } catch (e) {
                // Ignore invalid local storage data.
            }
        }
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
                <p className={styles.note}>入力内容はブラウザに保存され、SB3ファイルにも格納されます。</p>
            </section>
        );
    }
}
ProjectInfo.propTypes = {projectId: PropTypes.string, instructions: PropTypes.string, credits: PropTypes.string};
export default ProjectInfo;
