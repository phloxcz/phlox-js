import { Presenter, computed } from 'phlox-js';
import { Form, FormView, Multiplier } from 'phlox-js/forms';
import { t } from '../i18n';
import { CATEGORIES, ShoppingStore } from '../model/ShoppingStore';

interface Ingredient {
  name: string;
  amount: number | null;
  unit: string;
  category: number | null;
}

interface RecipeInput {
  name: string;
  source: { author: string; link: string };
  ingredients: Ingredient[];
}

const UNITS = ['ks', 'g', 'kg', 'ml', 'l', 'lžíce', 'hrnek'];

/**
 * A recipe whose ingredients go to the shopping list, at /recipe. It shows addContainer() for a nested
 * object and addMultiplier() for rows that the user adds, removes and orders by dragging or by arrow keys.
 */
export default class RecipePresenter extends Presenter {
  form = new Form<RecipeInput>();
  ingredients: Multiplier<Ingredient>;
  /** Follows typing in any row, like a total of an invoice would. */
  filled = computed(() => this.ingredients.getValues().filter(ingredient => ingredient.name.trim()).length);

  constructor(private store: ShoppingStore) {
    super();
    this.form.addText('name', t('recipe.name')).setRequired(t('recipe.nameRequired'));

    const source = this.form.addContainer('source', t('recipe.source'));
    source.addText('author', t('recipe.author'));
    source.addText('link', t('recipe.link')).addCondition(Form.Filled).addRule(Form.URL, t('recipe.badLink'));

    this.ingredients = this.form.addMultiplier('ingredients', row => {
      row.addText('name', t('recipe.ingredient')).setRequired(t('recipe.ingredientRequired'));
      row.addFloat('amount', t('recipe.amount')).addCondition(Form.Filled).addRule(Form.Min, t('recipe.positive'), 0.001);
      row.addSelect('unit', t('recipe.unit'), UNITS.map(unit => [unit, unit]));
      row.addDropDownList('category', t('edit.category'), { items: CATEGORIES, placeholder: t('list.category') });
    }, { min: 1, max: 20, label: t('recipe.ingredients') });

    this.form.setDefaults({
      name: 'Palačinky',
      ingredients: [
        { name: 'Mléko', amount: 0.5, unit: 'l', category: 2 },
        { name: 'Mouka hladká', amount: 250, unit: 'g', category: 1 },
        { name: 'Vejce', amount: 2, unit: 'ks', category: 2 },
      ],
    });
    this.form.addSubmit('save', t('recipe.save'));
    this.form.onSuccess = values => this.handleSave(values);
  }

  async handleSave(values: RecipeInput) {
    for (const ingredient of values.ingredients) {
      const amount = ingredient.amount === null ? '' : ` ${ingredient.amount} ${ingredient.unit}`;
      await this.store.add(`${ingredient.name.trim()}${amount}`, ingredient.category);
    }
    this.flashMessage(t('recipe.saved', { count: values.ingredients.length, name: values.name }), 'success');
    this.redirect('/');
  }

  render() {
    return (
      <section class="recipe">
        <h1>{t('recipe.title')}</h1>
        <p>{() => t('recipe.filled', { count: this.filled() })}</p>
        <FormView form={this.form} />
      </section>
    );
  }
}
