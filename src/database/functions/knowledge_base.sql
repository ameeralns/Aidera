-- Function to increment article views
create or replace function increment_article_views(p_article_id uuid)
returns void as $$
begin
    insert into kb_article_stats (article_id, views_count)
    values (p_article_id, 1)
    on conflict (article_id)
    do update set
        views_count = kb_article_stats.views_count + 1,
        last_viewed_at = now();
end;
$$ language plpgsql security definer;

-- Function to update article feedback stats
create or replace function update_article_feedback_stats(p_article_id uuid, p_is_helpful boolean)
returns void as $$
begin
    update kb_article_stats
    set
        helpful_count = case when p_is_helpful then helpful_count + 1 else helpful_count end,
        not_helpful_count = case when not p_is_helpful then not_helpful_count + 1 else not_helpful_count end
    where article_id = p_article_id;
end;
$$ language plpgsql security definer; 