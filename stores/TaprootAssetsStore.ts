import { action, observable } from 'mobx';
import BackendUtils from './../utils/BackendUtils';

export default class TaprootAssetsStore {
    @observable public assets: any = {};

    reset = () => {
        this.assets = {};
    };

    @action
    public listAssets = async () => {
        console.log('calling assets')
        const { assets } = await BackendUtils.taprootAssetsListAssets();
        this.assets = assets;
        console.log('assets', this.assets);
        console.log('assets length', this.assets.length);
        return this.assets;
    };
}
